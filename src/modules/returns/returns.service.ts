import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  type EntityManager,
  Repository,
} from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { InventoryService } from '../inventory/public';
import {
  OrderEntity,
  OrderLineEntity,
} from '../order/public';
import { PaymentEngine } from '../payment-engine/public';
import { WarehouseEntity } from '../warehouses/public';
import { ReturnLineEntity } from './entities/return-line.entity';
import { ReturnEntity } from './entities/return.entity';
import {
  canTransitionReturnStatus,
  isReturnResolution,
  type ReturnStatus,
} from './return-status';
import type {
  CompleteRefundInput,
  CreateReturnInput,
  ReturnLineType,
  ReturnType,
} from './returns.types';

function toLineType(row: ReturnLineEntity): ReturnLineType {
  return {
    id: row.id,
    returnId: row.returnId,
    orderLineId: row.orderLineId,
    variantId: row.variantId,
    quantity: row.quantity,
    reason: row.reason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toReturnType(row: ReturnEntity): ReturnType {
  return {
    id: row.id,
    orderId: row.orderId,
    warehouseId: row.warehouseId,
    status: row.status,
    resolution: row.resolution,
    reason: row.reason,
    notes: row.notes,
    paymentId: row.paymentId,
    replacementOrderId: row.replacementOrderId,
    refundAmountMinor: row.refundAmountMinor,
    approvedAt: row.approvedAt,
    receivedAt: row.receivedAt,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    lines: (row.lines ?? []).map(toLineType),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Core RMA workflow: requested → approved → received → refunded|exchanged.
 * Restocks on receive; refunds via PaymentEngine; exchange creates a pending
 * replacement order stub (E-02 undetermined-item decision).
 */
@Injectable()
export class ReturnsService {
  constructor(
    @InjectRepository(ReturnEntity)
    private readonly returns: Repository<ReturnEntity>,
    @InjectRepository(WarehouseEntity)
    private readonly warehouses: Repository<WarehouseEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderLineEntity)
    private readonly orderLines: Repository<OrderLineEntity>,
    private readonly inventory: InventoryService,
    private readonly payments: PaymentEngine,
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(status?: ReturnStatus): Promise<ReturnType[]> {
    const rows = await this.returns.find({
      where: status ? { status } : {},
      relations: { lines: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map(toReturnType);
  }

  async findById(id: string): Promise<ReturnType> {
    const row = await this.returns.findOne({
      where: { id },
      relations: { lines: true },
    });
    if (!row) {
      throw new NotFoundException(`Return ${id} not found`);
    }
    return toReturnType(row);
  }

  async findByOrderId(orderId: string): Promise<ReturnType[]> {
    const rows = await this.returns.find({
      where: { orderId },
      relations: { lines: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toReturnType);
  }

  /**
   * Create an RMA in `requested` status for confirmed/fulfilled order lines.
   */
  async create(input: CreateReturnInput): Promise<ReturnType> {
    if (!input.lines?.length) {
      throw new BadRequestException('At least one return line is required');
    }
    if (!isReturnResolution(input.resolution)) {
      throw new BadRequestException(
        `Invalid resolution "${input.resolution}"; expected refund or exchange`,
      );
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
          `Duplicate orderLineId ${line.orderLineId} in return lines`,
        );
      }
      orderLineIds.add(line.orderLineId);
    }

    await this.requireActiveWarehouse(input.warehouseId);

    const order = await this.orders.findOne({ where: { id: input.orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${input.orderId} not found`);
    }
    if (order.status !== 'confirmed' && order.status !== 'fulfilled') {
      throw new BadRequestException(
        `Order ${input.orderId} is ${order.status}, expected confirmed or fulfilled`,
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

    const alreadyRequested = await this.openReturnedQuantityByOrderLine(
      input.orderId,
    );

    for (const line of input.lines) {
      const orderLine = orderLineById.get(line.orderLineId)!;
      const prior = alreadyRequested.get(line.orderLineId) ?? 0;
      if (prior + line.quantity > orderLine.quantity) {
        throw new BadRequestException(
          `Return quantity ${line.quantity} for order line ${line.orderLineId} exceeds remaining returnable (${orderLine.quantity - prior})`,
        );
      }
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const rma = manager.create(ReturnEntity, {
        orderId: input.orderId,
        warehouseId: input.warehouseId,
        status: 'requested',
        resolution: input.resolution,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        paymentId: null,
        replacementOrderId: null,
        refundAmountMinor: null,
        approvedAt: null,
        receivedAt: null,
        completedAt: null,
        cancelledAt: null,
      });
      const header = await manager.save(rma);

      const lines = input.lines.map((line) => {
        const orderLine = orderLineById.get(line.orderLineId)!;
        return manager.create(ReturnLineEntity, {
          returnId: header.id,
          orderLineId: line.orderLineId,
          variantId: orderLine.variantId,
          quantity: line.quantity,
          reason: line.reason ?? null,
        });
      });
      header.lines = await manager.save(lines);
      return header;
    });

    await this.eventBus.publish({
      eventName: CoreEventName.ReturnRequested,
      aggregateType: 'return',
      aggregateId: saved.id,
      data: {
        returnId: saved.id,
        orderId: saved.orderId,
        warehouseId: saved.warehouseId,
        resolution: saved.resolution,
        lineCount: saved.lines.length,
        requestedAt: saved.createdAt.toISOString(),
      },
    });

    return toReturnType(saved);
  }

  /** Approve a requested RMA. */
  async approve(id: string): Promise<ReturnType> {
    await this.dataSource.transaction(async (manager) => {
      const rma = await this.lockReturn(manager, id);
      this.assertTransition(rma.status, 'approved');
      rma.status = 'approved';
      rma.approvedAt = new Date();
      await manager.save(rma);
    });
    return this.findById(id);
  }

  /**
   * Mark goods received and restock each line into the RMA warehouse.
   */
  async receive(id: string): Promise<ReturnType> {
    const snapshot = await this.dataSource.transaction(async (manager) => {
      const rma = await this.lockReturn(manager, id);
      this.assertTransition(rma.status, 'received');
      rma.status = 'received';
      rma.receivedAt = new Date();
      await manager.save(rma);
      return {
        id: rma.id,
        warehouseId: rma.warehouseId,
        lines: (rma.lines ?? []).map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
        })),
      };
    });

    for (const line of snapshot.lines) {
      await this.inventory.adjust({
        variantId: line.variantId,
        warehouseId: snapshot.warehouseId,
        delta: line.quantity,
        reason: `RMA ${snapshot.id} restock`,
      });
    }

    return this.findById(id);
  }

  /**
   * Complete a refund-resolution RMA via PaymentEngine after receive.
   */
  async completeRefund(input: CompleteRefundInput): Promise<ReturnType> {
    const rma = await this.requireReturn(input.returnId);
    if (rma.resolution !== 'refund') {
      throw new BadRequestException(
        `Return ${input.returnId} resolution is ${rma.resolution}, expected refund`,
      );
    }
    this.assertTransition(rma.status, 'refunded');

    const amountMinor =
      input.amountMinor ?? (await this.computeRefundAmountMinor(rma));
    if (!/^\d+$/.test(amountMinor) || amountMinor === '0') {
      throw new BadRequestException(
        'Refund amountMinor must be a positive integer string',
      );
    }

    let paymentId = input.paymentId ?? null;
    if (!paymentId) {
      const payments = await this.payments.findByOrderId(rma.orderId);
      const captured = payments.find((p) => p.status === 'captured');
      if (!captured) {
        throw new BadRequestException(
          `No captured payment found for order ${rma.orderId}`,
        );
      }
      paymentId = captured.id;
    }

    const payment = await this.payments.findById(paymentId);
    if (payment.orderId !== rma.orderId) {
      throw new BadRequestException(
        `Payment ${paymentId} does not belong to order ${rma.orderId}`,
      );
    }

    const refunded = await this.payments.refund({
      paymentId,
      amount: {
        amountMinor,
        currencyCode: (await this.orders.findOne({
          where: { id: rma.orderId },
        }))!.currencyCode,
      },
      idempotencyKey: input.idempotencyKey,
      metadata: { returnId: rma.id },
    });

    if (refunded.status !== 'refunded') {
      throw new BadRequestException(
        `PaymentEngine refund did not complete (status=${refunded.status})`,
      );
    }

    const completedAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      const locked = await this.lockReturn(manager, input.returnId);
      this.assertTransition(locked.status, 'refunded');
      locked.status = 'refunded';
      locked.paymentId = paymentId;
      locked.refundAmountMinor = amountMinor;
      locked.completedAt = completedAt;
      await manager.save(locked);
    });

    await this.eventBus.publish({
      eventName: CoreEventName.RefundCompleted,
      aggregateType: 'return',
      aggregateId: input.returnId,
      data: {
        returnId: input.returnId,
        orderId: rma.orderId,
        paymentId,
        refundAmountMinor: amountMinor,
        completedAt: completedAt.toISOString(),
      },
    });

    return this.findById(input.returnId);
  }

  /**
   * Complete an exchange-resolution RMA: create a pending replacement order stub.
   */
  async completeExchange(id: string): Promise<ReturnType> {
    const rma = await this.requireReturn(id);
    if (rma.resolution !== 'exchange') {
      throw new BadRequestException(
        `Return ${id} resolution is ${rma.resolution}, expected exchange`,
      );
    }
    this.assertTransition(rma.status, 'exchanged');

    const order = await this.orders.findOne({ where: { id: rma.orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${rma.orderId} not found`);
    }

    const completedAt = new Date();
    const replacementOrderId = await this.dataSource.transaction(
      async (manager) => {
        const locked = await this.lockReturn(manager, id);
        this.assertTransition(locked.status, 'exchanged');

        let subtotal = 0n;
        const stubLines: Array<{
          variantId: string;
          quantity: number;
          unitPriceMinor: string;
          lineTotalMinor: string;
        }> = [];

        for (const line of locked.lines ?? []) {
          const orderLine = await manager.findOne(OrderLineEntity, {
            where: { id: line.orderLineId },
          });
          if (!orderLine) {
            throw new BadRequestException(
              `Order line ${line.orderLineId} not found for exchange stub`,
            );
          }
          const unit = BigInt(orderLine.unitPriceMinor);
          const lineTotal = unit * BigInt(line.quantity);
          subtotal += lineTotal;
          stubLines.push({
            variantId: line.variantId,
            quantity: line.quantity,
            unitPriceMinor: orderLine.unitPriceMinor,
            lineTotalMinor: lineTotal.toString(),
          });
        }

        const replacement = await manager.save(
          manager.create(OrderEntity, {
            customerId: order.customerId,
            cartId: null,
            status: 'pending',
            currencyCode: order.currencyCode,
            subtotalMinor: subtotal.toString(),
            taxMinor: '0',
            shippingMinor: '0',
            discountMinor: '0',
            couponCode: null,
            shippingMethodCode: null,
            shippingRateCode: null,
            totalMinor: subtotal.toString(),
          }),
        );

        await manager.save(
          stubLines.map((line) =>
            manager.create(OrderLineEntity, {
              orderId: replacement.id,
              variantId: line.variantId,
              quantity: line.quantity,
              unitPriceMinor: line.unitPriceMinor,
              lineTotalMinor: line.lineTotalMinor,
            }),
          ),
        );

        locked.status = 'exchanged';
        locked.replacementOrderId = replacement.id;
        locked.completedAt = completedAt;
        locked.notes = locked.notes
          ? `${locked.notes}\n[exchange stub order ${replacement.id}]`
          : `[exchange stub order ${replacement.id}]`;
        await manager.save(locked);
        return replacement.id;
      },
    );

    if (!replacementOrderId) {
      throw new BadRequestException('Failed to create exchange replacement order');
    }
    return this.findById(id);
  }

  /** Cancel a requested or approved RMA. */
  async cancel(id: string): Promise<ReturnType> {
    await this.dataSource.transaction(async (manager) => {
      const rma = await this.lockReturn(manager, id);
      this.assertTransition(rma.status, 'cancelled');
      rma.status = 'cancelled';
      rma.cancelledAt = new Date();
      await manager.save(rma);
    });
    return this.findById(id);
  }

  private assertTransition(from: ReturnStatus, to: ReturnStatus): void {
    if (!canTransitionReturnStatus(from, to)) {
      throw new BadRequestException(
        `Cannot transition return from ${from} to ${to}`,
      );
    }
  }

  private async requireReturn(id: string): Promise<ReturnEntity> {
    const row = await this.returns.findOne({
      where: { id },
      relations: { lines: true },
    });
    if (!row) {
      throw new NotFoundException(`Return ${id} not found`);
    }
    return row;
  }

  private async lockReturn(
    manager: EntityManager,
    id: string,
  ): Promise<ReturnEntity> {
    const rma = await manager
      .getRepository(ReturnEntity)
      .createQueryBuilder('rma')
      .setLock('pessimistic_write')
      .where('rma.id = :id', { id })
      .getOne();
    if (!rma) {
      throw new NotFoundException(`Return ${id} not found`);
    }
    rma.lines = await manager.find(ReturnLineEntity, {
      where: { returnId: id },
    });
    return rma;
  }

  private async requireActiveWarehouse(warehouseId: string): Promise<void> {
    const warehouse = await this.warehouses.findOne({
      where: { id: warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse ${warehouseId} not found`);
    }
    if (!warehouse.isActive) {
      throw new BadRequestException(`Warehouse ${warehouseId} is inactive`);
    }
  }

  /** Quantities already on non-cancelled RMAs for an order. */
  private async openReturnedQuantityByOrderLine(
    orderId: string,
  ): Promise<Map<string, number>> {
    const existing = await this.returns.find({
      where: { orderId },
      relations: { lines: true },
    });
    const map = new Map<string, number>();
    for (const rma of existing) {
      if (rma.status === 'cancelled') {
        continue;
      }
      for (const line of rma.lines ?? []) {
        map.set(
          line.orderLineId,
          (map.get(line.orderLineId) ?? 0) + line.quantity,
        );
      }
    }
    return map;
  }

  private async computeRefundAmountMinor(
    rma: ReturnEntity,
  ): Promise<string> {
    let total = 0n;
    for (const line of rma.lines ?? []) {
      const orderLine = await this.orderLines.findOne({
        where: { id: line.orderLineId },
      });
      if (!orderLine) {
        throw new BadRequestException(
          `Order line ${line.orderLineId} not found for refund calc`,
        );
      }
      total += BigInt(orderLine.unitPriceMinor) * BigInt(line.quantity);
    }
    return total.toString();
  }
}
