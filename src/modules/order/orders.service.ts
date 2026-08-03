import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InventoryService } from '../inventory/public';
import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { CartService } from './cart.service';
import {
  canTransitionOrderStatus,
  isOrderStatus,
  type OrderStatus,
} from './entities/order-status';
import { OrderLineEntity } from './entities/order-line.entity';
import { OrderEntity } from './entities/order.entity';
import type {
  OrderLineType,
  OrderType,
  PlaceOrderInput,
  UpdateOrderStatusInput,
} from './order.types';

function lineTotalMinor(unitPriceMinor: string, quantity: number): string {
  return (BigInt(unitPriceMinor) * BigInt(quantity)).toString();
}

function toLineType(row: OrderLineEntity): OrderLineType {
  return {
    id: row.id,
    orderId: row.orderId,
    variantId: row.variantId,
    quantity: row.quantity,
    unitPriceMinor: String(row.unitPriceMinor),
    lineTotalMinor: String(row.lineTotalMinor),
    createdAt: row.createdAt,
  };
}

function toOrderType(row: OrderEntity, lines: OrderLineEntity[]): OrderType {
  return {
    id: row.id,
    customerId: row.customerId,
    cartId: row.cartId,
    status: row.status,
    currencyCode: row.currencyCode,
    subtotalMinor: String(row.subtotalMinor),
    taxMinor: String(row.taxMinor),
    shippingMinor: String(row.shippingMinor),
    totalMinor: String(row.totalMinor),
    lines: lines.map(toLineType),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderLineEntity)
    private readonly lines: Repository<OrderLineEntity>,
    private readonly carts: CartService,
    private readonly inventory: InventoryService,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(): Promise<OrderType[]> {
    const rows = await this.orders.find({ order: { createdAt: 'ASC' } });
    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  async findById(id: string): Promise<OrderType> {
    const row = await this.orders.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return this.hydrate(row);
  }

  /**
   * Place order from a locked cart (D-04).
   * Manual/zero payment — no payment capture; inventory reservations are committed.
   */
  async placeOrder(input: PlaceOrderInput): Promise<OrderType> {
    const paymentMethod = input.paymentMethod ?? 'manual';
    if (paymentMethod !== 'manual' && paymentMethod !== 'zero') {
      throw new BadRequestException(
        'paymentMethod must be "manual" or "zero"',
      );
    }

    const { cart, lines } = await this.carts.getEntityWithLines(input.cartId);

    if (cart.status !== 'locked') {
      throw new BadRequestException(
        `Cart ${input.cartId} must be locked via prepareCheckout before placing an order (status=${cart.status})`,
      );
    }
    if (lines.length === 0) {
      throw new BadRequestException(`Cart ${input.cartId} has no lines`);
    }

    for (const line of lines) {
      if (!line.reservationId) {
        throw new BadRequestException(
          `Cart line ${line.id} has no inventory reservation; run prepareCheckout first`,
        );
      }
    }

    let subtotal = 0n;
    for (const line of lines) {
      subtotal += BigInt(lineTotalMinor(String(line.unitPriceMinor), line.quantity));
    }
    const taxMinor = 0n;
    const shippingMinor = 0n;
    const totalMinor = subtotal + taxMinor + shippingMinor;

    if (paymentMethod === 'zero' && totalMinor !== 0n) {
      throw new BadRequestException(
        `Zero payment requires a zero total (got ${totalMinor.toString()})`,
      );
    }

    const order = await this.orders.save(
      this.orders.create({
        customerId: cart.customerId,
        cartId: cart.id,
        status: 'pending',
        currencyCode: cart.currencyCode,
        subtotalMinor: subtotal.toString(),
        taxMinor: taxMinor.toString(),
        shippingMinor: shippingMinor.toString(),
        totalMinor: totalMinor.toString(),
      }),
    );

    await this.lines.save(
      lines.map((line) =>
        this.lines.create({
          orderId: order.id,
          variantId: line.variantId,
          quantity: line.quantity,
          unitPriceMinor: String(line.unitPriceMinor),
          lineTotalMinor: lineTotalMinor(
            String(line.unitPriceMinor),
            line.quantity,
          ),
        }),
      ),
    );

    for (const line of lines) {
      await this.inventory.commit(line.reservationId!);
    }

    await this.carts.setStatus(cart.id, 'converted');

    await this.eventBus.publish({
      eventName: CoreEventName.OrderCreated,
      aggregateType: 'order',
      aggregateId: order.id,
      data: {
        orderId: order.id,
        cartId: cart.id,
        customerId: cart.customerId,
        status: 'pending',
        currencyCode: cart.currencyCode,
        totalMinor: totalMinor.toString(),
        paymentMethod,
      },
    });

    await this.publishTimeline({
      orderId: order.id,
      type: 'created',
      fromStatus: null,
      toStatus: 'pending',
      paymentMethod,
      note: `Order placed via ${paymentMethod} payment`,
    });

    await this.publishTimeline({
      orderId: order.id,
      type: 'payment_recorded',
      fromStatus: 'pending',
      toStatus: 'pending',
      paymentMethod,
      note:
        paymentMethod === 'zero'
          ? 'Zero-total order; no payment capture'
          : 'Manual payment accepted without capture',
    });

    // Manual/zero path: accept order immediately (no gateway).
    return this.transitionStatus(order.id, 'confirmed', {
      note: `Auto-confirmed after ${paymentMethod} payment path`,
    });
  }

  /**
   * Apply an allowed status transition and publish timeline events (D-05).
   */
  async updateStatus(input: UpdateOrderStatusInput): Promise<OrderType> {
    if (!isOrderStatus(input.status)) {
      throw new BadRequestException(
        `Invalid order status "${input.status}"`,
      );
    }
    return this.transitionStatus(input.id, input.status);
  }

  private async transitionStatus(
    orderId: string,
    toStatus: OrderStatus,
    opts?: { note?: string },
  ): Promise<OrderType> {
    const row = await this.orders.findOne({ where: { id: orderId } });
    if (!row) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const fromStatus = row.status;
    if (fromStatus === toStatus) {
      return this.hydrate(row);
    }

    if (!canTransitionOrderStatus(fromStatus, toStatus)) {
      throw new BadRequestException(
        `Invalid order status transition: ${fromStatus} → ${toStatus}`,
      );
    }

    row.status = toStatus;
    const saved = await this.orders.save(row);

    await this.eventBus.publish({
      eventName: CoreEventName.OrderStatusChanged,
      aggregateType: 'order',
      aggregateId: saved.id,
      data: {
        orderId: saved.id,
        fromStatus,
        toStatus,
      },
    });

    if (toStatus === 'cancelled') {
      await this.eventBus.publish({
        eventName: CoreEventName.OrderCancelled,
        aggregateType: 'order',
        aggregateId: saved.id,
        data: {
          orderId: saved.id,
          fromStatus,
        },
      });
    }

    await this.publishTimeline({
      orderId: saved.id,
      type: 'status_changed',
      fromStatus,
      toStatus,
      paymentMethod: null,
      note: opts?.note ?? null,
    });

    return this.hydrate(saved);
  }

  private async publishTimeline(data: {
    orderId: string;
    type: 'created' | 'status_changed' | 'payment_recorded';
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    paymentMethod: 'manual' | 'zero' | null;
    note: string | null;
  }): Promise<void> {
    await this.eventBus.publish({
      eventName: CoreEventName.OrderTimeline,
      aggregateType: 'order',
      aggregateId: data.orderId,
      data,
    });
  }

  private async hydrate(row: OrderEntity): Promise<OrderType> {
    const lines = await this.lines.find({
      where: { orderId: row.id },
      order: { createdAt: 'ASC' },
    });
    return toOrderType(row, lines);
  }
}
