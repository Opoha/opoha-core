import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  type EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { InventoryItemEntity } from '../inventory/public';
import {
  OrderEntity,
  OrderLineEntity,
  OrdersService,
} from '../order/public';
import { WarehouseEntity } from '../warehouses/public';
import { FulfillmentLineEntity } from './entities/fulfillment-line.entity';
import { FulfillmentPackageEntity } from './entities/fulfillment-package.entity';
import {
  FulfillmentEntity,
  type FulfillmentStatus,
} from './entities/fulfillment.entity';
import type {
  CreateFulfillmentInput,
  FulfillmentLineType,
  FulfillmentPackageType,
  FulfillmentType,
  PackFulfillmentInput,
  ShipFulfillmentInput,
} from './fulfillment.types';

function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23503'
  );
}

function toLineType(row: FulfillmentLineEntity): FulfillmentLineType {
  return {
    id: row.id,
    fulfillmentId: row.fulfillmentId,
    orderLineId: row.orderLineId,
    variantId: row.variantId,
    quantity: row.quantity,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPackageType(row: FulfillmentPackageEntity): FulfillmentPackageType {
  return {
    id: row.id,
    fulfillmentId: row.fulfillmentId,
    trackingNumber: row.trackingNumber,
    carrierCode: row.carrierCode,
    labelUrl: row.labelUrl,
    weightGrams: row.weightGrams,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toFulfillmentType(row: FulfillmentEntity): FulfillmentType {
  return {
    id: row.id,
    orderId: row.orderId,
    warehouseId: row.warehouseId,
    status: row.status,
    notes: row.notes,
    trackingNumber: row.trackingNumber,
    pickedAt: row.pickedAt,
    packedAt: row.packedAt,
    shippedAt: row.shippedAt,
    lines: (row.lines ?? []).map(toLineType),
    packages: (row.packages ?? []).map(toPackageType),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class FulfillmentService {
  constructor(
    @InjectRepository(FulfillmentEntity)
    private readonly fulfillments: Repository<FulfillmentEntity>,
    @InjectRepository(WarehouseEntity)
    private readonly warehouses: Repository<WarehouseEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderLineEntity)
    private readonly orderLines: Repository<OrderLineEntity>,
    private readonly ordersService: OrdersService,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(status?: FulfillmentStatus): Promise<FulfillmentType[]> {
    const rows = await this.fulfillments.find({
      where: status ? { status } : {},
      relations: { lines: true, packages: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map(toFulfillmentType);
  }

  async findById(id: string): Promise<FulfillmentType> {
    const row = await this.fulfillments.findOne({
      where: { id },
      relations: { lines: true, packages: true },
    });
    if (!row) {
      throw new NotFoundException(`Fulfillment ${id} not found`);
    }
    return toFulfillmentType(row);
  }

  async findByOrderId(orderId: string): Promise<FulfillmentType[]> {
    const rows = await this.fulfillments.find({
      where: { orderId },
      relations: { lines: true, packages: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toFulfillmentType);
  }

  /**
   * Create a pending fulfillment for a subset (or all) of confirmed order lines.
   * Stock was already committed at placeOrder; this allocates remaining line qty
   * to a warehouse pick/pack/ship workflow.
   */
  async create(input: CreateFulfillmentInput): Promise<FulfillmentType> {
    if (!input.lines?.length) {
      throw new BadRequestException('At least one fulfillment line is required');
    }

    const orderLineIds = new Set<string>();
    for (const line of input.lines) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        throw new BadRequestException(
          'Each line quantity must be a positive integer',
        );
      }
      if (orderLineIds.has(line.orderLineId)) {
        throw new BadRequestException(
          `Duplicate orderLineId ${line.orderLineId} in fulfillment lines`,
        );
      }
      orderLineIds.add(line.orderLineId);
    }

    await this.requireActiveWarehouse(input.warehouseId);

    const order = await this.orders.findOne({ where: { id: input.orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${input.orderId} not found`);
    }
    if (order.status !== 'confirmed') {
      throw new BadRequestException(
        `Order ${input.orderId} is ${order.status}, expected confirmed`,
      );
    }

    const allOrderLines = await this.orderLines.find({
      where: { orderId: input.orderId },
    });
    const orderLineById = new Map(allOrderLines.map((l) => [l.id, l]));
    for (const lineId of orderLineIds) {
      if (!orderLineById.has(lineId)) {
        throw new BadRequestException(
          `Order line ${lineId} does not belong to order ${input.orderId}`,
        );
      }
    }

    const alreadyShipped = await this.shippedQuantityByOrderLine(input.orderId);
    // Include non-cancelled open fulfillments so we don't over-allocate.
    const allocatedOpen = await this.openAllocatedQuantityByOrderLine(
      input.orderId,
    );

    for (const line of input.lines) {
      const orderLine = orderLineById.get(line.orderLineId)!;
      const used =
        (alreadyShipped.get(line.orderLineId) ?? 0) +
        (allocatedOpen.get(line.orderLineId) ?? 0);
      const remaining = orderLine.quantity - used;
      if (line.quantity > remaining) {
        throw new ConflictException(
          `Order line ${line.orderLineId} has only ${remaining} qty remaining to fulfill (requested=${line.quantity})`,
        );
      }
    }

    let saved: FulfillmentEntity;
    try {
      saved = await this.dataSource.transaction(async (manager) => {
        const fulfillment = await manager.save(
          manager.create(FulfillmentEntity, {
            orderId: input.orderId,
            warehouseId: input.warehouseId,
            status: 'pending',
            notes: input.notes?.trim() || null,
            trackingNumber: null,
            pickedAt: null,
            packedAt: null,
            shippedAt: null,
          }),
        );
        const lines = input.lines.map((line) => {
          const orderLine = orderLineById.get(line.orderLineId)!;
          return manager.create(FulfillmentLineEntity, {
            fulfillmentId: fulfillment.id,
            orderLineId: line.orderLineId,
            variantId: orderLine.variantId,
            quantity: line.quantity,
          });
        });
        await manager.save(lines);
        return fulfillment;
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new BadRequestException(
          'Invalid order, warehouse, or order line reference',
        );
      }
      throw error;
    }

    return this.findById(saved.id);
  }

  /**
   * Mark pending fulfillment as picked (goods pulled from warehouse location).
   */
  async pick(id: string): Promise<FulfillmentType> {
    await this.dataSource.transaction(async (manager) => {
      const fulfillment = await this.lockFulfillment(manager, id);
      if (fulfillment.status !== 'pending') {
        throw new BadRequestException(
          `Fulfillment ${id} is ${fulfillment.status}, expected pending`,
        );
      }
      fulfillment.status = 'picked';
      fulfillment.pickedAt = new Date();
      await manager.save(fulfillment);
    });
    return this.findById(id);
  }

  /**
   * Mark picked fulfillment as packed; optionally create packages.
   */
  async pack(
    id: string,
    input: PackFulfillmentInput = {},
  ): Promise<FulfillmentType> {
    await this.dataSource.transaction(async (manager) => {
      const fulfillment = await this.lockFulfillment(manager, id);
      if (fulfillment.status !== 'picked') {
        throw new BadRequestException(
          `Fulfillment ${id} is ${fulfillment.status}, expected picked`,
        );
      }

      if (input.packages?.length) {
        for (const pkg of input.packages) {
          if (
            pkg.weightGrams != null &&
            (!Number.isInteger(pkg.weightGrams) || pkg.weightGrams <= 0)
          ) {
            throw new BadRequestException(
              'Package weightGrams must be a positive integer when set',
            );
          }
        }
        const packages = input.packages.map((pkg) =>
          manager.create(FulfillmentPackageEntity, {
            fulfillmentId: id,
            trackingNumber: pkg.trackingNumber?.trim() || null,
            carrierCode: pkg.carrierCode?.trim() || null,
            labelUrl: pkg.labelUrl?.trim() || null,
            weightGrams: pkg.weightGrams ?? null,
          }),
        );
        await manager.save(packages);
      }

      fulfillment.status = 'packed';
      fulfillment.packedAt = new Date();
      await manager.save(fulfillment);
    });
    return this.findById(id);
  }

  /**
   * Ship a packed fulfillment from its warehouse.
   * Validates inventory rows exist at the warehouse (allocation location).
   * Publishes ShipmentCreated; marks the order fulfilled when all qty is shipped.
   * Stock on-hand was already deducted at placeOrder (reservation commit).
   */
  async ship(
    id: string,
    input: ShipFulfillmentInput = {},
  ): Promise<FulfillmentType> {
    const snapshot = await this.dataSource.transaction(async (manager) => {
      const fulfillment = await this.lockFulfillment(manager, id);
      if (fulfillment.status !== 'packed') {
        throw new BadRequestException(
          `Fulfillment ${id} is ${fulfillment.status}, expected packed`,
        );
      }

      const lines = await manager.find(FulfillmentLineEntity, {
        where: { fulfillmentId: id },
        order: { orderLineId: 'ASC' },
      });
      if (!lines.length) {
        throw new BadRequestException(`Fulfillment ${id} has no lines`);
      }

      for (const line of lines) {
        const item = await manager
          .getRepository(InventoryItemEntity)
          .createQueryBuilder('item')
          .setLock('pessimistic_write')
          .where(
            'item.variantId = :variantId AND item.warehouseId = :warehouseId',
            {
              variantId: line.variantId,
              warehouseId: fulfillment.warehouseId,
            },
          )
          .getOne();

        if (!item) {
          throw new ConflictException(
            `No inventory allocation for variant ${line.variantId} at warehouse ${fulfillment.warehouseId}`,
          );
        }
      }

      const packages = await manager.find(FulfillmentPackageEntity, {
        where: { fulfillmentId: id },
        order: { createdAt: 'ASC' },
      });
      const tracking =
        input.trackingNumber?.trim() ||
        packages.find((p) => p.trackingNumber)?.trackingNumber ||
        null;

      fulfillment.status = 'shipped';
      fulfillment.shippedAt = new Date();
      fulfillment.trackingNumber = tracking;
      await manager.save(fulfillment);

      const order = await manager.findOne(OrderEntity, {
        where: { id: fulfillment.orderId },
      });

      return {
        fulfillmentId: fulfillment.id,
        orderId: fulfillment.orderId,
        warehouseId: fulfillment.warehouseId,
        trackingNumber: tracking,
        customerId: order?.customerId ?? null,
        lineCount: lines.length,
        shippedAt: fulfillment.shippedAt.toISOString(),
      };
    });

    await this.eventBus.publish({
      eventName: CoreEventName.ShipmentCreated,
      aggregateType: 'fulfillment',
      aggregateId: snapshot.fulfillmentId,
      data: {
        fulfillmentId: snapshot.fulfillmentId,
        orderId: snapshot.orderId,
        warehouseId: snapshot.warehouseId,
        trackingNumber: snapshot.trackingNumber,
        customerId: snapshot.customerId,
        lineCount: snapshot.lineCount,
        shippedAt: snapshot.shippedAt,
      },
    });

    await this.maybeMarkOrderFulfilled(snapshot.orderId);

    return this.findById(id);
  }

  /**
   * Cancel a pending or picked fulfillment (no shipment yet).
   */
  async cancel(id: string): Promise<FulfillmentType> {
    await this.dataSource.transaction(async (manager) => {
      const fulfillment = await this.lockFulfillment(manager, id);
      if (fulfillment.status !== 'pending' && fulfillment.status !== 'picked') {
        throw new BadRequestException(
          `Fulfillment ${id} is ${fulfillment.status}, only pending/picked can be cancelled`,
        );
      }
      fulfillment.status = 'cancelled';
      await manager.save(fulfillment);
    });
    return this.findById(id);
  }

  private async maybeMarkOrderFulfilled(orderId: string): Promise<void> {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order || order.status !== 'confirmed') {
      return;
    }

    const orderLines = await this.orderLines.find({ where: { orderId } });
    const shipped = await this.shippedQuantityByOrderLine(orderId);

    const fullyShipped = orderLines.every(
      (line) => (shipped.get(line.id) ?? 0) >= line.quantity,
    );
    if (!fullyShipped) {
      return;
    }

    await this.ordersService.updateStatus({
      id: orderId,
      status: 'fulfilled',
    });
  }

  private async shippedQuantityByOrderLine(
    orderId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.fulfillments.find({
      where: { orderId, status: 'shipped' },
      relations: { lines: true },
    });
    const qty = new Map<string, number>();
    for (const f of rows) {
      for (const line of f.lines ?? []) {
        qty.set(
          line.orderLineId,
          (qty.get(line.orderLineId) ?? 0) + line.quantity,
        );
      }
    }
    return qty;
  }

  /** Qty allocated on pending/picked/packed (not yet shipped or cancelled). */
  private async openAllocatedQuantityByOrderLine(
    orderId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.fulfillments.find({
      where: [
        { orderId, status: 'pending' },
        { orderId, status: 'picked' },
        { orderId, status: 'packed' },
      ],
      relations: { lines: true },
    });
    const qty = new Map<string, number>();
    for (const f of rows) {
      for (const line of f.lines ?? []) {
        qty.set(
          line.orderLineId,
          (qty.get(line.orderLineId) ?? 0) + line.quantity,
        );
      }
    }
    return qty;
  }

  private async lockFulfillment(
    manager: EntityManager,
    id: string,
  ): Promise<FulfillmentEntity> {
    const fulfillment = await manager
      .getRepository(FulfillmentEntity)
      .createQueryBuilder('f')
      .setLock('pessimistic_write')
      .where('f.id = :id', { id })
      .getOne();

    if (!fulfillment) {
      throw new NotFoundException(`Fulfillment ${id} not found`);
    }
    return fulfillment;
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
