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
import { InventoryReservationEntity } from './entities/inventory-reservation.entity';
import type {
  AdjustInventoryInput,
  CreateInventoryItemInput,
  InventoryAdjustmentType,
  InventoryItemType,
  InventoryReservationType,
  ReserveInventoryInput,
} from './inventory.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23503'
  );
}

function toItemType(row: InventoryItemEntity): InventoryItemType {
  return {
    id: row.id,
    variantId: row.variantId,
    warehouseId: row.warehouseId,
    quantityOnHand: row.quantityOnHand,
    quantityReserved: row.quantityReserved,
    quantityAvailable: row.quantityOnHand - row.quantityReserved,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toReservationType(
  row: InventoryReservationEntity,
): InventoryReservationType {
  return {
    id: row.id,
    inventoryItemId: row.inventoryItemId,
    quantity: row.quantity,
    status: row.status,
    reference: row.reference,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAdjustmentType(
  row: InventoryAdjustmentEntity,
): InventoryAdjustmentType {
  return {
    id: row.id,
    inventoryItemId: row.inventoryItemId,
    delta: row.delta,
    reason: row.reason,
    quantityOnHandAfter: row.quantityOnHandAfter,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItemEntity)
    private readonly items: Repository<InventoryItemEntity>,
    @InjectRepository(InventoryReservationEntity)
    private readonly reservations: Repository<InventoryReservationEntity>,
    @InjectRepository(InventoryAdjustmentEntity)
    private readonly adjustments: Repository<InventoryAdjustmentEntity>,
    @InjectRepository(WarehouseEntity)
    private readonly warehouses: Repository<WarehouseEntity>,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Resolve warehouse id — explicit id, else the default warehouse.
   */
  async resolveWarehouseId(warehouseId?: string | null): Promise<string> {
    if (warehouseId) {
      const row = await this.warehouses.findOne({ where: { id: warehouseId } });
      if (!row) {
        throw new NotFoundException(`Warehouse ${warehouseId} not found`);
      }
      if (!row.isActive) {
        throw new BadRequestException(
          `Warehouse ${warehouseId} is not active`,
        );
      }
      return row.id;
    }
    const def = await this.warehouses.findOne({ where: { isDefault: true } });
    if (!def) {
      throw new BadRequestException(
        'No default warehouse configured; create one or pass warehouseId',
      );
    }
    return def.id;
  }

  async findAll(warehouseId?: string): Promise<InventoryItemType[]> {
    const rows = await this.items.find({
      where: warehouseId ? { warehouseId } : {},
      order: { createdAt: 'ASC' },
    });
    return rows.map(toItemType);
  }

  async findById(id: string): Promise<InventoryItemType> {
    const row = await this.items.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }
    return toItemType(row);
  }

  /**
   * Stock for a variant at a warehouse (default warehouse when omitted).
   */
  async findByVariantId(
    variantId: string,
    warehouseId?: string,
  ): Promise<InventoryItemType> {
    const resolvedWarehouseId = await this.resolveWarehouseId(warehouseId);
    const row = await this.items.findOne({
      where: { variantId, warehouseId: resolvedWarehouseId },
    });
    if (!row) {
      throw new NotFoundException(
        `Inventory item for variant ${variantId} at warehouse ${resolvedWarehouseId} not found`,
      );
    }
    return toItemType(row);
  }

  async create(input: CreateInventoryItemInput): Promise<InventoryItemType> {
    const onHand = input.quantityOnHand ?? 0;
    if (!Number.isInteger(onHand) || onHand < 0) {
      throw new BadRequestException('quantityOnHand must be a non-negative integer');
    }
    const warehouseId = await this.resolveWarehouseId(input.warehouseId);
    const item = this.items.create({
      variantId: input.variantId,
      warehouseId,
      quantityOnHand: onHand,
      quantityReserved: 0,
    });
    try {
      const saved = await this.items.save(item);
      return this.findById(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Inventory item for variant ${input.variantId} at warehouse ${warehouseId} already exists`,
        );
      }
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException(
          `Product variant ${input.variantId} or warehouse ${warehouseId} does not exist`,
        );
      }
      throw error;
    }
  }

  /**
   * Apply a signed on-hand adjustment inside a pessimistic lock transaction.
   */
  async adjust(input: AdjustInventoryInput): Promise<InventoryItemType> {
    if (!Number.isInteger(input.delta) || input.delta === 0) {
      throw new BadRequestException('delta must be a non-zero integer');
    }

    const warehouseId = await this.resolveWarehouseId(input.warehouseId);

    const snapshot = await this.dataSource.transaction(async (manager) => {
      let item = await manager
        .getRepository(InventoryItemEntity)
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where(
          'item.variantId = :variantId AND item.warehouseId = :warehouseId',
          { variantId: input.variantId, warehouseId },
        )
        .getOne();

      if (!item) {
        try {
          item = await manager.save(
            manager.create(InventoryItemEntity, {
              variantId: input.variantId,
              warehouseId,
              quantityOnHand: 0,
              quantityReserved: 0,
            }),
          );
        } catch (error) {
          if (isForeignKeyViolation(error)) {
            throw new BadRequestException(
              `Product variant ${input.variantId} or warehouse ${warehouseId} does not exist`,
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
            `Inventory item for variant ${input.variantId} at warehouse ${warehouseId} not found`,
          );
        }
      }

      const nextOnHand = item.quantityOnHand + input.delta;
      if (nextOnHand < 0) {
        throw new BadRequestException(
          `Adjustment would make on-hand negative (current=${item.quantityOnHand}, delta=${input.delta})`,
        );
      }
      if (nextOnHand < item.quantityReserved) {
        throw new BadRequestException(
          `Adjustment would leave on-hand (${nextOnHand}) below reserved (${item.quantityReserved})`,
        );
      }

      item.quantityOnHand = nextOnHand;
      await manager.save(item);
      await manager.save(
        manager.create(InventoryAdjustmentEntity, {
          inventoryItemId: item.id,
          delta: input.delta,
          reason: input.reason?.trim() || null,
          quantityOnHandAfter: nextOnHand,
        }),
      );
      return {
        inventoryItemId: item.id,
        variantId: item.variantId,
        warehouseId: item.warehouseId,
        delta: input.delta,
        quantityOnHand: nextOnHand,
        quantityReserved: item.quantityReserved,
        reason: input.reason?.trim() || null,
      };
    });

    await this.eventBus.publish({
      eventName: CoreEventName.InventoryUpdated,
      aggregateType: 'inventory_item',
      aggregateId: snapshot.inventoryItemId,
      data: snapshot,
    });

    return this.findById(snapshot.inventoryItemId);
  }

  /**
   * Reserve stock for a variant at a warehouse; fails if available qty is insufficient.
   * Omitting warehouseId uses the default warehouse (checkout/order path).
   */
  async reserve(
    input: ReserveInventoryInput,
  ): Promise<InventoryReservationType> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('quantity must be a positive integer');
    }

    const warehouseId = await this.resolveWarehouseId(input.warehouseId);

    const snapshot = await this.dataSource.transaction(async (manager) => {
      let item = await manager
        .getRepository(InventoryItemEntity)
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where(
          'item.variantId = :variantId AND item.warehouseId = :warehouseId',
          { variantId: input.variantId, warehouseId },
        )
        .getOne();

      if (!item) {
        try {
          item = await manager.save(
            manager.create(InventoryItemEntity, {
              variantId: input.variantId,
              warehouseId,
              quantityOnHand: 0,
              quantityReserved: 0,
            }),
          );
        } catch (error) {
          if (isForeignKeyViolation(error)) {
            throw new BadRequestException(
              `Product variant ${input.variantId} or warehouse ${warehouseId} does not exist`,
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
            `Inventory item for variant ${input.variantId} at warehouse ${warehouseId} not found`,
          );
        }
      }

      const available = item.quantityOnHand - item.quantityReserved;
      if (input.quantity > available) {
        throw new ConflictException(
          `Insufficient stock for variant ${input.variantId} at warehouse ${warehouseId} (available=${available}, requested=${input.quantity})`,
        );
      }

      item.quantityReserved += input.quantity;
      await manager.save(item);

      const reservation = await manager.save(
        manager.create(InventoryReservationEntity, {
          inventoryItemId: item.id,
          quantity: input.quantity,
          status: 'active',
          reference: input.reference?.trim() || null,
        }),
      );
      return {
        reservationId: reservation.id,
        inventoryItemId: item.id,
        variantId: item.variantId,
        warehouseId: item.warehouseId,
        quantity: input.quantity,
        reference: reservation.reference,
        quantityReserved: item.quantityReserved,
        quantityAvailable: item.quantityOnHand - item.quantityReserved,
      };
    });

    await this.eventBus.publish({
      eventName: CoreEventName.InventoryReservationCreated,
      aggregateType: 'inventory_reservation',
      aggregateId: snapshot.reservationId,
      data: snapshot,
    });

    const row = await this.reservations.findOne({
      where: { id: snapshot.reservationId },
    });
    if (!row) {
      throw new NotFoundException(
        `Reservation ${snapshot.reservationId} not found`,
      );
    }
    return toReservationType(row);
  }

  /**
   * Release an active reservation and free reserved quantity.
   */
  async release(reservationId: string): Promise<InventoryReservationType> {
    const snapshot = await this.dataSource.transaction(async (manager) => {
      const reservation = await manager
        .getRepository(InventoryReservationEntity)
        .createQueryBuilder('res')
        .setLock('pessimistic_write')
        .where('res.id = :id', { id: reservationId })
        .getOne();

      if (!reservation) {
        throw new NotFoundException(`Reservation ${reservationId} not found`);
      }
      if (reservation.status !== 'active') {
        throw new BadRequestException(
          `Reservation ${reservationId} is ${reservation.status}, not active`,
        );
      }

      const item = await manager
        .getRepository(InventoryItemEntity)
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.id = :id', { id: reservation.inventoryItemId })
        .getOne();

      if (!item) {
        throw new NotFoundException(
          `Inventory item ${reservation.inventoryItemId} not found`,
        );
      }

      item.quantityReserved = Math.max(
        0,
        item.quantityReserved - reservation.quantity,
      );
      await manager.save(item);

      reservation.status = 'released';
      await manager.save(reservation);

      return {
        reservationId: reservation.id,
        inventoryItemId: item.id,
        variantId: item.variantId,
        warehouseId: item.warehouseId,
        quantity: reservation.quantity,
        quantityReserved: item.quantityReserved,
        quantityAvailable: item.quantityOnHand - item.quantityReserved,
      };
    });

    await this.eventBus.publish({
      eventName: CoreEventName.InventoryReservationReleased,
      aggregateType: 'inventory_reservation',
      aggregateId: snapshot.reservationId,
      data: snapshot,
    });

    const row = await this.reservations.findOne({
      where: { id: reservationId },
    });
    if (!row) {
      throw new NotFoundException(`Reservation ${reservationId} not found`);
    }
    return toReservationType(row);
  }

  /**
   * Commit an active reservation: deduct on-hand and free reserved qty.
   * Used when an order is placed against checkout reservations.
   */
  async commit(reservationId: string): Promise<InventoryReservationType> {
    const snapshot = await this.dataSource.transaction(async (manager) => {
      const reservation = await manager
        .getRepository(InventoryReservationEntity)
        .createQueryBuilder('res')
        .setLock('pessimistic_write')
        .where('res.id = :id', { id: reservationId })
        .getOne();

      if (!reservation) {
        throw new NotFoundException(`Reservation ${reservationId} not found`);
      }
      if (reservation.status !== 'active') {
        throw new BadRequestException(
          `Reservation ${reservationId} is ${reservation.status}, not active`,
        );
      }

      const item = await manager
        .getRepository(InventoryItemEntity)
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.id = :id', { id: reservation.inventoryItemId })
        .getOne();

      if (!item) {
        throw new NotFoundException(
          `Inventory item ${reservation.inventoryItemId} not found`,
        );
      }

      if (item.quantityOnHand < reservation.quantity) {
        throw new ConflictException(
          `Cannot commit reservation ${reservationId}: on-hand ${item.quantityOnHand} < ${reservation.quantity}`,
        );
      }

      item.quantityOnHand -= reservation.quantity;
      item.quantityReserved = Math.max(
        0,
        item.quantityReserved - reservation.quantity,
      );
      await manager.save(item);

      reservation.status = 'committed';
      await manager.save(reservation);

      return {
        reservationId: reservation.id,
        inventoryItemId: item.id,
        variantId: item.variantId,
        warehouseId: item.warehouseId,
        quantity: reservation.quantity,
        quantityOnHand: item.quantityOnHand,
        quantityReserved: item.quantityReserved,
        quantityAvailable: item.quantityOnHand - item.quantityReserved,
      };
    });

    await this.eventBus.publish({
      eventName: CoreEventName.InventoryUpdated,
      aggregateType: 'inventory_item',
      aggregateId: snapshot.inventoryItemId,
      data: {
        inventoryItemId: snapshot.inventoryItemId,
        variantId: snapshot.variantId,
        warehouseId: snapshot.warehouseId,
        delta: -snapshot.quantity,
        quantityOnHand: snapshot.quantityOnHand,
        quantityReserved: snapshot.quantityReserved,
        reason: `reservation_committed:${snapshot.reservationId}`,
      },
    });

    const row = await this.reservations.findOne({
      where: { id: reservationId },
    });
    if (!row) {
      throw new NotFoundException(`Reservation ${reservationId} not found`);
    }
    return toReservationType(row);
  }

  async listAdjustments(
    inventoryItemId: string,
  ): Promise<InventoryAdjustmentType[]> {
    const rows = await this.adjustments.find({
      where: { inventoryItemId },
      order: { createdAt: 'DESC' },
    });
    return rows.map(toAdjustmentType);
  }
}
