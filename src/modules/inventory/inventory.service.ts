import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';

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
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<InventoryItemType[]> {
    const rows = await this.items.find({ order: { createdAt: 'ASC' } });
    return rows.map(toItemType);
  }

  async findById(id: string): Promise<InventoryItemType> {
    const row = await this.items.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }
    return toItemType(row);
  }

  async findByVariantId(variantId: string): Promise<InventoryItemType> {
    const row = await this.items.findOne({ where: { variantId } });
    if (!row) {
      throw new NotFoundException(
        `Inventory item for variant ${variantId} not found`,
      );
    }
    return toItemType(row);
  }

  async create(input: CreateInventoryItemInput): Promise<InventoryItemType> {
    const onHand = input.quantityOnHand ?? 0;
    if (!Number.isInteger(onHand) || onHand < 0) {
      throw new BadRequestException('quantityOnHand must be a non-negative integer');
    }
    const item = this.items.create({
      variantId: input.variantId,
      quantityOnHand: onHand,
      quantityReserved: 0,
    });
    try {
      const saved = await this.items.save(item);
      return this.findById(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Inventory item for variant ${input.variantId} already exists`,
        );
      }
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException(
          `Product variant ${input.variantId} does not exist`,
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

    const itemId = await this.dataSource.transaction(async (manager) => {
      let item = await manager
        .getRepository(InventoryItemEntity)
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.variantId = :variantId', { variantId: input.variantId })
        .getOne();

      if (!item) {
        try {
          item = await manager.save(
            manager.create(InventoryItemEntity, {
              variantId: input.variantId,
              quantityOnHand: 0,
              quantityReserved: 0,
            }),
          );
        } catch (error) {
          if (isForeignKeyViolation(error)) {
            throw new BadRequestException(
              `Product variant ${input.variantId} does not exist`,
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
            `Inventory item for variant ${input.variantId} not found`,
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
      return item.id;
    });

    return this.findById(itemId);
  }

  /**
   * Reserve stock for a variant; fails if available quantity is insufficient.
   */
  async reserve(
    input: ReserveInventoryInput,
  ): Promise<InventoryReservationType> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('quantity must be a positive integer');
    }

    const reservationId = await this.dataSource.transaction(async (manager) => {
      let item = await manager
        .getRepository(InventoryItemEntity)
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.variantId = :variantId', { variantId: input.variantId })
        .getOne();

      if (!item) {
        try {
          item = await manager.save(
            manager.create(InventoryItemEntity, {
              variantId: input.variantId,
              quantityOnHand: 0,
              quantityReserved: 0,
            }),
          );
        } catch (error) {
          if (isForeignKeyViolation(error)) {
            throw new BadRequestException(
              `Product variant ${input.variantId} does not exist`,
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
            `Inventory item for variant ${input.variantId} not found`,
          );
        }
      }

      const available = item.quantityOnHand - item.quantityReserved;
      if (input.quantity > available) {
        throw new ConflictException(
          `Insufficient stock for variant ${input.variantId} (available=${available}, requested=${input.quantity})`,
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
      return reservation.id;
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
   * Release an active reservation and free reserved quantity.
   */
  async release(reservationId: string): Promise<InventoryReservationType> {
    await this.dataSource.transaction(async (manager) => {
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
