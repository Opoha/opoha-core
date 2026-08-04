import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { InventoryAdjustmentEntity, InventoryItemEntity } from '../inventory/public';
import { WarehouseEntity } from '../warehouses/public';
import { PurchaseOrderLineEntity } from './entities/purchase-order-line.entity';
import { PurchaseOrderEntity, type PurchaseOrderStatus } from './entities/purchase-order.entity';
import { SupplierEntity } from './entities/supplier.entity';
import type {
  CreatePurchaseOrderInput,
  PurchaseOrderLineType,
  PurchaseOrderType,
} from './purchase-order.types';

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23503'
  );
}

function toLineType(row: PurchaseOrderLineEntity): PurchaseOrderLineType {
  return {
    id: row.id,
    purchaseOrderId: row.purchaseOrderId,
    variantId: row.variantId,
    quantity: row.quantity,
    quantityReceived: row.quantityReceived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPurchaseOrderType(row: PurchaseOrderEntity): PurchaseOrderType {
  return {
    id: row.id,
    supplierId: row.supplierId,
    warehouseId: row.warehouseId,
    status: row.status,
    notes: row.notes,
    receivedAt: row.receivedAt,
    lines: (row.lines ?? []).map(toLineType),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(PurchaseOrderEntity)
    private readonly purchaseOrders: Repository<PurchaseOrderEntity>,
    @InjectRepository(SupplierEntity)
    private readonly suppliers: Repository<SupplierEntity>,
    @InjectRepository(WarehouseEntity)
    private readonly warehouses: Repository<WarehouseEntity>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(status?: PurchaseOrderStatus): Promise<PurchaseOrderType[]> {
    const rows = await this.purchaseOrders.find({
      where: status ? { status } : {},
      relations: { lines: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map(toPurchaseOrderType);
  }

  async findById(id: string): Promise<PurchaseOrderType> {
    const row = await this.purchaseOrders.findOne({
      where: { id },
      relations: { lines: true },
    });
    if (!row) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    return toPurchaseOrderType(row);
  }

  /**
   * Create a draft purchase order; no stock movement until receive.
   */
  async create(input: CreatePurchaseOrderInput): Promise<PurchaseOrderType> {
    if (!input.lines?.length) {
      throw new BadRequestException('At least one purchase order line is required');
    }

    const variantIds = new Set<string>();
    for (const line of input.lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new BadRequestException('Each line quantity must be a positive integer');
      }
      if (variantIds.has(line.variantId)) {
        throw new BadRequestException(
          `Duplicate variantId ${line.variantId} in purchase order lines`,
        );
      }
      variantIds.add(line.variantId);
    }

    await this.requireActiveSupplier(input.supplierId);
    await this.requireActiveWarehouse(input.warehouseId);

    let saved: PurchaseOrderEntity;
    try {
      saved = await this.dataSource.transaction(async (manager) => {
        const po = await manager.save(
          manager.create(PurchaseOrderEntity, {
            supplierId: input.supplierId,
            warehouseId: input.warehouseId,
            status: 'draft',
            notes: input.notes?.trim() || null,
            receivedAt: null,
          }),
        );
        const lines = input.lines.map((line) =>
          manager.create(PurchaseOrderLineEntity, {
            purchaseOrderId: po.id,
            variantId: line.variantId,
            quantity: line.quantity,
            quantityReceived: 0,
          }),
        );
        await manager.save(lines);
        return po;
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException('Invalid supplier, warehouse, or product variant reference');
      }
      throw error;
    }

    const result = await this.findById(saved.id);
    await this.eventBus.publish({
      eventName: CoreEventName.PurchaseOrderCreated,
      aggregateType: 'purchase_order',
      aggregateId: result.id,
      data: {
        purchaseOrderId: result.id,
        supplierId: result.supplierId,
        warehouseId: result.warehouseId,
        status: result.status,
        lineCount: result.lines.length,
      },
    });
    return result;
  }

  /**
   * Receive a draft PO: credit warehouse stock for all ordered quantities.
   */
  async receive(id: string): Promise<PurchaseOrderType> {
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
      const po = await manager
.getRepository(PurchaseOrderEntity)
.createQueryBuilder('po')
.setLock('pessimistic_write')
.where('po.id = :id', { id })
.getOne();

      if (!po) {
        throw new NotFoundException(`Purchase order ${id} not found`);
      }
      if (po.status !== 'draft') {
        throw new BadRequestException(`Purchase order ${id} is ${po.status}, expected draft`);
      }

      const lines = await manager.find(PurchaseOrderLineEntity, {
        where: { purchaseOrderId: id },
        order: { variantId: 'ASC' },
      });
      if (!lines.length) {
        throw new BadRequestException(`Purchase order ${id} has no lines`);
      }

      for (const line of lines) {
        let item = await manager
.getRepository(InventoryItemEntity)
.createQueryBuilder('item')
.setLock('pessimistic_write')
.where('item.variantId = :variantId AND item.warehouseId = :warehouseId', {
            variantId: line.variantId,
            warehouseId: po.warehouseId,
          })
.getOne();

        if (!item) {
          try {
            item = await manager.save(
              manager.create(InventoryItemEntity, {
                variantId: line.variantId,
                warehouseId: po.warehouseId,
                quantityOnHand: 0,
                quantityReserved: 0,
              }),
            );
          } catch (error) {
            if (isForeignKeyViolation(error)) {
              throw new BadRequestException(
                `Product variant ${line.variantId} or warehouse ${po.warehouseId} does not exist`,
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
              `Inventory item for variant ${line.variantId} at warehouse ${po.warehouseId} not found`,
            );
          }
        }

        item.quantityOnHand += line.quantity;
        await manager.save(item);
        line.quantityReceived = line.quantity;
        await manager.save(line);
        await manager.save(
          manager.create(InventoryAdjustmentEntity, {
            inventoryItemId: item.id,
            delta: line.quantity,
            reason: `po_receive:${po.id}`,
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
          reason: `po_receive:${po.id}`,
        });
      }

      po.status = 'received';
      po.receivedAt = new Date();
      await manager.save(po);
      return {
        purchaseOrderId: po.id,
        supplierId: po.supplierId,
        warehouseId: po.warehouseId,
        status: po.status as string,
        receivedAt: po.receivedAt.toISOString(),
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
      eventName: CoreEventName.PurchaseOrderReceived,
      aggregateType: 'purchase_order',
      aggregateId: snapshot.purchaseOrderId,
      data: snapshot,
    });

    return this.findById(id);
  }

  /**
   * Cancel a draft purchase order (no stock was moved).
   */
  async cancel(id: string): Promise<PurchaseOrderType> {
    const snapshot = await this.dataSource.transaction(async (manager) => {
      const po = await manager
.getRepository(PurchaseOrderEntity)
.createQueryBuilder('po')
.setLock('pessimistic_write')
.where('po.id = :id', { id })
.getOne();

      if (!po) {
        throw new NotFoundException(`Purchase order ${id} not found`);
      }
      if (po.status !== 'draft') {
        throw new BadRequestException(
          `Purchase order ${id} is ${po.status}, only draft POs can be cancelled`,
        );
      }

      po.status = 'cancelled';
      await manager.save(po);
      return {
        purchaseOrderId: po.id,
        supplierId: po.supplierId,
        warehouseId: po.warehouseId,
        status: po.status as string,
      };
    });

    await this.eventBus.publish({
      eventName: CoreEventName.PurchaseOrderCancelled,
      aggregateType: 'purchase_order',
      aggregateId: snapshot.purchaseOrderId,
      data: snapshot,
    });

    return this.findById(id);
  }

  private async requireActiveSupplier(supplierId: string): Promise<void> {
    const row = await this.suppliers.findOne({ where: { id: supplierId } });
    if (!row) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }
    if (!row.isActive) {
      throw new BadRequestException(`Supplier ${supplierId} is not active`);
    }
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
