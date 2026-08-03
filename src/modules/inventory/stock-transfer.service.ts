import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { WarehouseEntity } from '../warehouses/entities/warehouse.entity';
import { InventoryAdjustmentEntity } from './entities/inventory-adjustment.entity';
import { InventoryItemEntity } from './entities/inventory-item.entity';
import { StockTransferLineEntity } from './entities/stock-transfer-line.entity';
import {
  StockTransferEntity,
  type StockTransferStatus,
} from './entities/stock-transfer.entity';
import type {
  CreateStockTransferInput,
  StockTransferLineType,
  StockTransferType,
} from './stock-transfer.types';

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23503'
  );
}

function toLineType(row: StockTransferLineEntity): StockTransferLineType {
  return {
    id: row.id,
    transferId: row.transferId,
    variantId: row.variantId,
    quantity: row.quantity,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toTransferType(row: StockTransferEntity): StockTransferType {
  return {
    id: row.id,
    fromWarehouseId: row.fromWarehouseId,
    toWarehouseId: row.toWarehouseId,
    status: row.status,
    notes: row.notes,
    shippedAt: row.shippedAt,
    receivedAt: row.receivedAt,
    lines: (row.lines ?? []).map(toLineType),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class StockTransferService {
  constructor(
    @InjectRepository(StockTransferEntity)
    private readonly transfers: Repository<StockTransferEntity>,
    @InjectRepository(WarehouseEntity)
    private readonly warehouses: Repository<WarehouseEntity>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(status?: StockTransferStatus): Promise<StockTransferType[]> {
    const rows = await this.transfers.find({
      where: status ? { status } : {},
      relations: { lines: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map(toTransferType);
  }

  async findById(id: string): Promise<StockTransferType> {
    const row = await this.transfers.findOne({
      where: { id },
      relations: { lines: true },
    });
    if (!row) {
      throw new NotFoundException(`Stock transfer ${id} not found`);
    }
    return toTransferType(row);
  }

  /**
   * Create a draft transfer; no stock movement until ship.
   */
  async create(input: CreateStockTransferInput): Promise<StockTransferType> {
    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new BadRequestException(
        'fromWarehouseId and toWarehouseId must differ',
      );
    }
    if (!input.lines?.length) {
      throw new BadRequestException('At least one transfer line is required');
    }

    const variantIds = new Set<string>();
    for (const line of input.lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new BadRequestException(
          'Each line quantity must be a positive integer',
        );
      }
      if (variantIds.has(line.variantId)) {
        throw new BadRequestException(
          `Duplicate variantId ${line.variantId} in transfer lines`,
        );
      }
      variantIds.add(line.variantId);
    }

    await this.requireActiveWarehouse(input.fromWarehouseId);
    await this.requireActiveWarehouse(input.toWarehouseId);

    let saved: StockTransferEntity;
    try {
      saved = await this.dataSource.transaction(async (manager) => {
        const transfer = await manager.save(
          manager.create(StockTransferEntity, {
            fromWarehouseId: input.fromWarehouseId,
            toWarehouseId: input.toWarehouseId,
            status: 'draft',
            notes: input.notes?.trim() || null,
            shippedAt: null,
            receivedAt: null,
          }),
        );
        const lines = input.lines.map((line) =>
          manager.create(StockTransferLineEntity, {
            transferId: transfer.id,
            variantId: line.variantId,
            quantity: line.quantity,
          }),
        );
        await manager.save(lines);
        return transfer;
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException(
          'Invalid warehouse or product variant reference',
        );
      }
      throw error;
    }

    const result = await this.findById(saved.id);
    await this.eventBus.publish({
      eventName: CoreEventName.StockTransferCreated,
      aggregateType: 'stock_transfer',
      aggregateId: result.id,
      data: {
        transferId: result.id,
        fromWarehouseId: result.fromWarehouseId,
        toWarehouseId: result.toWarehouseId,
        status: result.status,
        lineCount: result.lines.length,
      },
    });
    return result;
  }

  /**
   * Ship a draft transfer: deduct available stock at the source warehouse.
   */
  async ship(id: string): Promise<StockTransferType> {
    const inventoryEvents: Array<{
      inventoryItemId: string;
      variantId: string;
      warehouseId: string;
      delta: number;
      quantityOnHand: number;
      quantityReserved: number;
      reason: string;
    }> = [];

    const snapshot = await this.dataSource.transaction(async (manager) => {
      const transfer = await manager
        .getRepository(StockTransferEntity)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :id', { id })
        .getOne();

      if (!transfer) {
        throw new NotFoundException(`Stock transfer ${id} not found`);
      }
      if (transfer.status !== 'draft') {
        throw new BadRequestException(
          `Stock transfer ${id} is ${transfer.status}, expected draft`,
        );
      }

      const lines = await manager.find(StockTransferLineEntity, {
        where: { transferId: id },
        order: { variantId: 'ASC' },
      });
      if (!lines.length) {
        throw new BadRequestException(`Stock transfer ${id} has no lines`);
      }

      for (const line of lines) {
        let item = await manager
          .getRepository(InventoryItemEntity)
          .createQueryBuilder('item')
          .setLock('pessimistic_write')
          .where(
            'item.variantId = :variantId AND item.warehouseId = :warehouseId',
            {
              variantId: line.variantId,
              warehouseId: transfer.fromWarehouseId,
            },
          )
          .getOne();

        if (!item) {
          throw new ConflictException(
            `No inventory for variant ${line.variantId} at source warehouse ${transfer.fromWarehouseId}`,
          );
        }

        const available = item.quantityOnHand - item.quantityReserved;
        if (line.quantity > available) {
          throw new ConflictException(
            `Insufficient stock for variant ${line.variantId} at warehouse ${transfer.fromWarehouseId} (available=${available}, requested=${line.quantity})`,
          );
        }

        item.quantityOnHand -= line.quantity;
        await manager.save(item);
        await manager.save(
          manager.create(InventoryAdjustmentEntity, {
            inventoryItemId: item.id,
            delta: -line.quantity,
            reason: `transfer_ship:${transfer.id}`,
            quantityOnHandAfter: item.quantityOnHand,
          }),
        );
        inventoryEvents.push({
          inventoryItemId: item.id,
          variantId: item.variantId,
          warehouseId: item.warehouseId,
          delta: -line.quantity,
          quantityOnHand: item.quantityOnHand,
          quantityReserved: item.quantityReserved,
          reason: `transfer_ship:${transfer.id}`,
        });
      }

      transfer.status = 'in_transit';
      transfer.shippedAt = new Date();
      await manager.save(transfer);
      return {
        transferId: transfer.id,
        fromWarehouseId: transfer.fromWarehouseId,
        toWarehouseId: transfer.toWarehouseId,
        status: transfer.status as string,
        shippedAt: transfer.shippedAt.toISOString(),
        lineCount: lines.length,
      };
    });

    for (const data of inventoryEvents) {
      await this.eventBus.publish({
        eventName: CoreEventName.InventoryUpdated,
        aggregateType: 'inventory_item',
        aggregateId: data.inventoryItemId,
        data,
      });
    }
    await this.eventBus.publish({
      eventName: CoreEventName.StockTransferShipped,
      aggregateType: 'stock_transfer',
      aggregateId: snapshot.transferId,
      data: snapshot,
    });

    return this.findById(id);
  }

  /**
   * Receive an in-transit transfer: add stock at the destination warehouse.
   */
  async receive(id: string): Promise<StockTransferType> {
    const inventoryEvents: Array<{
      inventoryItemId: string;
      variantId: string;
      warehouseId: string;
      delta: number;
      quantityOnHand: number;
      quantityReserved: number;
      reason: string;
    }> = [];

    const snapshot = await this.dataSource.transaction(async (manager) => {
      const transfer = await manager
        .getRepository(StockTransferEntity)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :id', { id })
        .getOne();

      if (!transfer) {
        throw new NotFoundException(`Stock transfer ${id} not found`);
      }
      if (transfer.status !== 'in_transit') {
        throw new BadRequestException(
          `Stock transfer ${id} is ${transfer.status}, expected in_transit`,
        );
      }

      const lines = await manager.find(StockTransferLineEntity, {
        where: { transferId: id },
        order: { variantId: 'ASC' },
      });
      if (!lines.length) {
        throw new BadRequestException(`Stock transfer ${id} has no lines`);
      }

      for (const line of lines) {
        let item = await manager
          .getRepository(InventoryItemEntity)
          .createQueryBuilder('item')
          .setLock('pessimistic_write')
          .where(
            'item.variantId = :variantId AND item.warehouseId = :warehouseId',
            {
              variantId: line.variantId,
              warehouseId: transfer.toWarehouseId,
            },
          )
          .getOne();

        if (!item) {
          try {
            item = await manager.save(
              manager.create(InventoryItemEntity, {
                variantId: line.variantId,
                warehouseId: transfer.toWarehouseId,
                quantityOnHand: 0,
                quantityReserved: 0,
              }),
            );
          } catch (error) {
            if (isForeignKeyViolation(error)) {
              throw new BadRequestException(
                `Product variant ${line.variantId} or warehouse ${transfer.toWarehouseId} does not exist`,
              );
            }
            throw error;
          }
          item = await manager
            .getRepository(InventoryItemEntity)
            .createQueryBuilder('item')
            .setLock('pessimistic_write')
            .where('item.id = :id', { id: item.id })
            .getOne();
          if (!item) {
            throw new NotFoundException(
              `Inventory item for variant ${line.variantId} at warehouse ${transfer.toWarehouseId} not found`,
            );
          }
        }

        item.quantityOnHand += line.quantity;
        await manager.save(item);
        await manager.save(
          manager.create(InventoryAdjustmentEntity, {
            inventoryItemId: item.id,
            delta: line.quantity,
            reason: `transfer_receive:${transfer.id}`,
            quantityOnHandAfter: item.quantityOnHand,
          }),
        );
        inventoryEvents.push({
          inventoryItemId: item.id,
          variantId: item.variantId,
          warehouseId: item.warehouseId,
          delta: line.quantity,
          quantityOnHand: item.quantityOnHand,
          quantityReserved: item.quantityReserved,
          reason: `transfer_receive:${transfer.id}`,
        });
      }

      transfer.status = 'received';
      transfer.receivedAt = new Date();
      await manager.save(transfer);
      return {
        transferId: transfer.id,
        fromWarehouseId: transfer.fromWarehouseId,
        toWarehouseId: transfer.toWarehouseId,
        status: transfer.status as string,
        receivedAt: transfer.receivedAt.toISOString(),
        lineCount: lines.length,
      };
    });

    for (const data of inventoryEvents) {
      await this.eventBus.publish({
        eventName: CoreEventName.InventoryUpdated,
        aggregateType: 'inventory_item',
        aggregateId: data.inventoryItemId,
        data,
      });
    }
    await this.eventBus.publish({
      eventName: CoreEventName.StockTransferReceived,
      aggregateType: 'stock_transfer',
      aggregateId: snapshot.transferId,
      data: snapshot,
    });

    return this.findById(id);
  }

  /**
   * Cancel a draft transfer (no stock was moved).
   */
  async cancel(id: string): Promise<StockTransferType> {
    const snapshot = await this.dataSource.transaction(async (manager) => {
      const transfer = await manager
        .getRepository(StockTransferEntity)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :id', { id })
        .getOne();

      if (!transfer) {
        throw new NotFoundException(`Stock transfer ${id} not found`);
      }
      if (transfer.status !== 'draft') {
        throw new BadRequestException(
          `Stock transfer ${id} is ${transfer.status}, only draft transfers can be cancelled`,
        );
      }

      transfer.status = 'cancelled';
      await manager.save(transfer);
      return {
        transferId: transfer.id,
        fromWarehouseId: transfer.fromWarehouseId,
        toWarehouseId: transfer.toWarehouseId,
        status: transfer.status as string,
      };
    });

    await this.eventBus.publish({
      eventName: CoreEventName.StockTransferCancelled,
      aggregateType: 'stock_transfer',
      aggregateId: snapshot.transferId,
      data: snapshot,
    });

    return this.findById(id);
  }

  private async requireActiveWarehouse(warehouseId: string): Promise<void> {
    const row = await this.warehouses.findOne({ where: { id: warehouseId } });
    if (!row) {
      throw new NotFoundException(`Warehouse ${warehouseId} not found`);
    }
    if (!row.isActive) {
      throw new BadRequestException(`Warehouse ${warehouseId} is not active`);
    }
  }
}
