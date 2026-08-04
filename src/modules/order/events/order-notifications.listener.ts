import { Injectable, OnModuleInit, Optional } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { CoreEventName } from '../../event-bus/event-catalog';
import type { DomainEvent } from '../../event-bus/domain-event';
import { AppLogger } from '../../logging/app-logger';
import { NotificationTemplateCode, NotificationsService } from '../../notifications/public';
import { CustomersService } from '../../customer/public';
import { OrdersService } from '../orders.service';
import type { OrderCreatedData } from './order-events';
import type {
  PaymentCapturedData,
  PaymentFailedData,
  PaymentRefundedData,
} from '../../payment-engine/events/payment-events';

type PaymentEventData = PaymentCapturedData | PaymentRefundedData | PaymentFailedData;

/** Loose ShipmentCreated payload until fulfillment owns a strict schema. */
type ShipmentCreatedData = {
  orderId: string;
  trackingNumber?: string | null;
  customerId?: string | null;
  customerEmail?: string | null;
};

/**
 * Bridges order/payment/shipment domain events to templated transactional emails
 * (Phase 2 E-03). Uses `sendTemplated` / sendOrSkip semantics: no notification
 * provider registered simply means no email goes out yet — never fails checkout.
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
        NotificationTemplateCode.PaymentCaptured,
      ),
    );
    this.eventBus.subscribe(CoreEventName.PaymentRefunded, (event) =>
      this.handlePaymentEvent(
        event as DomainEvent<PaymentEventData>,
        NotificationTemplateCode.PaymentRefunded,
      ),
    );
    this.eventBus.subscribe(CoreEventName.PaymentFailed, (event) =>
      this.handlePaymentEvent(
        event as DomainEvent<PaymentEventData>,
        NotificationTemplateCode.PaymentFailed,
      ),
    );
    this.eventBus.subscribe(CoreEventName.ShipmentCreated, (event) =>
      this.handleShipmentCreated(event as DomainEvent<ShipmentCreatedData>),
    );
  }

  private async handleOrderCreated(event: DomainEvent<OrderCreatedData>): Promise<void> {
    const { orderId, customerId, totalMinor, currencyCode, paymentMethod } = event.data;
    const email = await this.resolveEmail(customerId);
    if (!email) {
      return;
    }
    await this.notifications.sendTemplated(
      NotificationTemplateCode.OrderConfirmation,
      { email },
      { orderId, totalMinor, currencyCode, paymentMethod },
    );
  }

  private async handlePaymentEvent(
    event: DomainEvent<PaymentEventData>,
    templateCode:
      | typeof NotificationTemplateCode.PaymentCaptured
      | typeof NotificationTemplateCode.PaymentRefunded
      | typeof NotificationTemplateCode.PaymentFailed,
  ): Promise<void> {
    const { orderId, paymentId, amountMinor, currencyCode, providerCode } = event.data;
    const errorMessage = 'errorMessage' in event.data ? event.data.errorMessage : undefined;

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
      {
        orderId,
        paymentId,
        amountMinor,
        currencyCode,
        providerCode,
        errorMessage,
      },
    );
  }

  private async handleShipmentCreated(event: DomainEvent<ShipmentCreatedData>): Promise<void> {
    const { orderId, trackingNumber, customerId, customerEmail } = event.data;
    const email =
      (customerEmail && customerEmail.trim()) ||
      (await this.resolveEmail(customerId ?? null)) ||
      (await this.resolveEmailFromOrder(orderId));
    if (!email) {
      return;
    }
    await this.notifications.sendTemplated(
      NotificationTemplateCode.ShipmentCreated,
      { email },
      { orderId, trackingNumber: trackingNumber ?? undefined },
    );
  }

  private async resolveEmailFromOrder(orderId: string): Promise<string | undefined> {
    try {
      const order = await this.orders.findById(orderId);
      return this.resolveEmail(order.customerId);
    } catch {
      return undefined;
    }
  }

  private async resolveEmail(customerId: string | null | undefined): Promise<string | undefined> {
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
