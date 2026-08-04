import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { DomainEvent } from '../../event-bus/domain-event';
import { CoreEventName } from '../../event-bus/event-catalog';
import { EventBusService } from '../../event-bus/event-bus.service';
import type { PaymentCapturedData } from '../../payment-engine/events/payment-events';
import { OrderEntity } from '../entities/order.entity';

/**
 * Bridge PaymentCaptured → OrderPaid for analytics / storefront sinks.
 * Idempotency key for sinks: `data.paymentId` (at-least-once bus delivery).
 */
@Injectable()
export class OrderPaidAnalyticsListener implements OnModuleInit {
  /** In-process dedupe for repeated PaymentCaptured delivery of the same payment. */
  private readonly publishedPaymentIds = new Set<string>();

  constructor(
    private readonly eventBus: EventBusService,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(
      CoreEventName.PaymentCaptured,
      (event) => this.onPaymentCaptured(event as DomainEvent<PaymentCapturedData>),
      { id: 'order-paid-analytics' },
    );
  }

  private async onPaymentCaptured(event: DomainEvent<PaymentCapturedData>): Promise<void> {
    const paymentId = event.data.paymentId;
    if (this.publishedPaymentIds.has(paymentId)) {
      return;
    }

    const order = await this.orders.findOne({
      where: { id: event.data.orderId },
    });
    if (!order) {
      return;
    }

    await this.eventBus.publish({
      eventName: CoreEventName.OrderPaid,
      aggregateType: 'order',
      aggregateId: order.id,
      data: {
        orderId: order.id,
        customerId: order.customerId,
        currencyCode: order.currencyCode,
        totalMinor: String(order.totalMinor ?? '0'),
        paymentId,
        providerCode: event.data.providerCode,
        amountMinor: event.data.amountMinor,
      },
      metadata: {
        correlationId: event.eventId,
      },
    });

    this.publishedPaymentIds.add(paymentId);
  }
}
