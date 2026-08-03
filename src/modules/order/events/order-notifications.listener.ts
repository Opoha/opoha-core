import { Injectable, OnModuleInit, Optional } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';
import { AppLogger } from '../../logging/app-logger';
import { NotificationsService } from '../../notifications/public';
import { CustomersService } from '../../customer/public';
import { OrdersService } from '../orders.service';
import type { OrderCreatedData } from './order-events';
import type {
  PaymentCapturedData,
  PaymentFailedData,
  PaymentRefundedData,
} from '../../payment-engine/events/payment-events';

type PaymentEventData =
  | PaymentCapturedData
  | PaymentRefundedData
  | PaymentFailedData;

/**
 * Bridges order/payment domain events to templated transactional emails
 * (Phase 2 E-03). Uses `sendOrSkip` semantics: no notification provider
 * registered simply means no email goes out yet — never fails checkout.
 */
@Injectable()
export class OrderNotificationsListener implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly orders: OrdersService,
    private readonly customers: CustomersService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly logger?: AppLogger,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(CoreEventName.OrderCreated, (event) =>
      this.handleOrderCreated(event as DomainEvent<OrderCreatedData>),
    );
    this.eventBus.subscribe(CoreEventName.PaymentCaptured, (event) =>
      this.handlePaymentEvent(
        event as DomainEvent<PaymentEventData>,
        'payment.captured',
      ),
    );
    this.eventBus.subscribe(CoreEventName.PaymentRefunded, (event) =>
      this.handlePaymentEvent(
        event as DomainEvent<PaymentEventData>,
        'payment.refunded',
      ),
    );
    this.eventBus.subscribe(CoreEventName.PaymentFailed, (event) =>
      this.handlePaymentEvent(
        event as DomainEvent<PaymentEventData>,
        'payment.failed',
      ),
    );
  }

  private async handleOrderCreated(
    event: DomainEvent<OrderCreatedData>,
  ): Promise<void> {
    const { orderId, customerId, totalMinor, currencyCode, paymentMethod } =
      event.data;
    const email = await this.resolveEmail(customerId);
    if (!email) {
      return;
    }
    await this.notifications.sendTemplated(
      'order.confirmation',
      { email },
      { orderId, totalMinor, currencyCode, paymentMethod },
    );
  }

  private async handlePaymentEvent(
    event: DomainEvent<PaymentEventData>,
    templateCode: 'payment.captured' | 'payment.refunded' | 'payment.failed',
  ): Promise<void> {
    const { orderId, amountMinor, currencyCode } = event.data;
    const errorMessage =
      'errorMessage' in event.data ? event.data.errorMessage : undefined;

    let customerId: string | null;
    try {
      customerId = (await this.orders.findById(orderId)).customerId;
    } catch {
      this.logger?.warn(
        `OrderNotificationsListener: order ${orderId} not found for ${templateCode}`,
        'OrderNotificationsListener',
      );
      return;
    }

    const email = await this.resolveEmail(customerId);
    if (!email) {
      return;
    }
    await this.notifications.sendTemplated(
      templateCode,
      { email },
      { orderId, amountMinor, currencyCode, errorMessage },
    );
  }

  private async resolveEmail(
    customerId: string | null,
  ): Promise<string | undefined> {
    if (!customerId) {
      return undefined;
    }
    try {
      const customer = await this.customers.findById(customerId);
      return customer.email;
    } catch {
      return undefined;
    }
  }
}
