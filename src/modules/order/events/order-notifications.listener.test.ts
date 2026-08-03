import { describe, expect, it, vi } from 'vitest';

import { EventBusService } from '../../event-bus/event-bus.service';
import { CoreEventName } from '../../event-bus/event-catalog';
import { NotificationProviderRegistry } from '../../notifications/notification-provider.registry';
import { NotificationTemplateRegistry } from '../../notifications/notification-template.registry';
import {
  NotificationTemplateCode,
} from '../../notifications/notification-template';
import { NotificationsService } from '../../notifications/notifications.service';
import type { NotificationSendInput } from '../../notifications/notification-provider';
import { OrderNotificationsListener } from './order-notifications.listener';

/**
 * E-05: event → template → provider mock.
 * Drives OrderNotificationsListener via EventBusService with stubbed
 * Orders/Customers and a capturing NotificationProvider.
 */
describe('OrderNotificationsListener (E-03 / E-05)', () => {
  function setup(opts?: {
    customerId?: string | null;
    customerEmail?: string;
    orderMissing?: boolean;
  }) {
    const eventBus = new EventBusService();
    const sent: NotificationSendInput[] = [];
    const notifications = new NotificationsService(
      new NotificationProviderRegistry(),
      new NotificationTemplateRegistry(),
      eventBus,
    );
    notifications.register({
      code: 'mock',
      displayName: 'Mock',
      async send(input) {
        sent.push(input);
        return {
          status: 'sent',
          providerCode: 'mock',
          messageId: `msg_${sent.length}`,
        };
      },
    });

    const customerId = opts?.customerId === undefined ? 'cust_1' : opts.customerId;
    const orders = {
      findById: vi.fn(async (id: string) => {
        if (opts?.orderMissing) {
          throw new Error(`Order ${id} not found`);
        }
        return {
          id,
          customerId,
          status: 'confirmed',
          currencyCode: 'USD',
          totalMinor: '1999',
        };
      }),
    };
    const customers = {
      findById: vi.fn(async (id: string) => {
        if (id !== 'cust_1') {
          throw new Error(`Customer ${id} not found`);
        }
        return {
          id: 'cust_1',
          email: opts?.customerEmail ?? 'buyer@example.com',
          firstName: 'Buyer',
          lastName: null,
          phone: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),
    };

    const listener = new OrderNotificationsListener(
      eventBus,
      orders as never,
      customers as never,
      notifications,
    );
    listener.onModuleInit();

    return { eventBus, sent, orders, customers };
  }

  it('OrderCreated → order.confirmation → provider.send with rendered subject', async () => {
    const { eventBus, sent } = setup();

    await eventBus.publish({
      eventName: CoreEventName.OrderCreated,
      aggregateType: 'order',
      aggregateId: 'ord_1',
      data: {
        orderId: 'ord_1',
        cartId: null,
        customerId: 'cust_1',
        status: 'pending',
        currencyCode: 'USD',
        totalMinor: '1999',
        paymentMethod: 'manual',
      },
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.templateCode).toBe(
      NotificationTemplateCode.OrderConfirmation,
    );
    expect(sent[0]?.to).toEqual({ email: 'buyer@example.com' });
    expect(sent[0]?.subject).toBe('Order confirmed — #ord_1');
    expect(sent[0]?.bodyText).toContain('19.99 USD');
  });

  it('PaymentCaptured → payment.captured with amount from event', async () => {
    const { eventBus, sent, orders } = setup();

    await eventBus.publish({
      eventName: CoreEventName.PaymentCaptured,
      aggregateType: 'payment',
      aggregateId: 'pay_1',
      data: {
        paymentId: 'pay_1',
        orderId: 'ord_1',
        providerCode: 'manual',
        amountMinor: '500',
        currencyCode: 'USD',
        externalId: null,
      },
    });

    expect(orders.findById).toHaveBeenCalledWith('ord_1');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.templateCode).toBe(
      NotificationTemplateCode.PaymentCaptured,
    );
    expect(sent[0]?.subject).toBe('Payment received — order #ord_1');
    expect(sent[0]?.bodyText).toContain('5.00 USD');
  });

  it('PaymentRefunded and PaymentFailed dispatch matching templates', async () => {
    const { eventBus, sent } = setup();

    await eventBus.publish({
      eventName: CoreEventName.PaymentRefunded,
      aggregateType: 'payment',
      aggregateId: 'pay_2',
      data: {
        paymentId: 'pay_2',
        orderId: 'ord_1',
        providerCode: 'manual',
        amountMinor: '200',
        currencyCode: 'USD',
        externalId: null,
      },
    });
    await eventBus.publish({
      eventName: CoreEventName.PaymentFailed,
      aggregateType: 'payment',
      aggregateId: 'pay_3',
      data: {
        paymentId: 'pay_3',
        orderId: 'ord_1',
        providerCode: 'manual',
        amountMinor: '1999',
        currencyCode: 'USD',
        externalId: null,
        errorMessage: 'card declined',
      },
    });

    expect(sent).toHaveLength(2);
    expect(sent[0]?.templateCode).toBe(
      NotificationTemplateCode.PaymentRefunded,
    );
    expect(sent[0]?.subject).toBe('Refund issued — order #ord_1');
    expect(sent[1]?.templateCode).toBe(NotificationTemplateCode.PaymentFailed);
    expect(sent[1]?.bodyText).toContain('card declined');
  });

  it('ShipmentCreated → shipment.created using customerEmail on event', async () => {
    const { eventBus, sent, customers } = setup({ customerId: null });

    await eventBus.publish({
      eventName: CoreEventName.ShipmentCreated,
      aggregateType: 'shipment',
      aggregateId: 'ship_1',
      data: {
        orderId: 'ord_1',
        trackingNumber: '1Z999',
        customerEmail: 'ship@example.com',
      },
    });

    expect(customers.findById).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.templateCode).toBe(
      NotificationTemplateCode.ShipmentCreated,
    );
    expect(sent[0]?.to).toEqual({ email: 'ship@example.com' });
    expect(sent[0]?.bodyText).toContain('1Z999');
  });

  it('skips send when customer has no resolvable email', async () => {
    const { eventBus, sent } = setup({ customerId: null });

    await eventBus.publish({
      eventName: CoreEventName.OrderCreated,
      aggregateType: 'order',
      aggregateId: 'ord_guest',
      data: {
        orderId: 'ord_guest',
        cartId: null,
        customerId: null,
        status: 'pending',
        currencyCode: 'USD',
        totalMinor: '100',
        paymentMethod: 'manual',
      },
    });

    expect(sent).toHaveLength(0);
  });

  it('skips payment mail when order lookup fails', async () => {
    const { eventBus, sent } = setup({ orderMissing: true });

    await eventBus.publish({
      eventName: CoreEventName.PaymentCaptured,
      aggregateType: 'payment',
      aggregateId: 'pay_x',
      data: {
        paymentId: 'pay_x',
        orderId: 'missing',
        providerCode: 'manual',
        amountMinor: '100',
        currencyCode: 'USD',
        externalId: null,
      },
    });

    expect(sent).toHaveLength(0);
  });
});
