import { describe, expect, it, vi } from 'vitest';

import { EventBusService } from '../../event-bus/event-bus.service';
import { CoreEventName } from '../../event-bus/event-catalog';
import { NotificationProviderRegistry } from '../../notifications/notification-provider.registry';
import { NotificationTemplateRegistry } from '../../notifications/notification-template.registry';
import { NotificationsService } from '../../notifications/notifications.service';
import type { NotificationProvider } from '../../notifications/notification-provider';
import { OrderNotificationsListener } from './order-notifications.listener';

function stubProvider(): NotificationProvider & {
  send: ReturnType<typeof vi.fn>;
} {
  return {
    code: 'smtp',
    displayName: 'SMTP',
    send: vi.fn(async () => ({
      status: 'sent' as const,
      providerCode: 'smtp',
      messageId: 'msg_1',
    })),
  };
}

function buildHarness() {
  const eventBus = new EventBusService();
  const notifications = new NotificationsService(
    new NotificationProviderRegistry(),
    new NotificationTemplateRegistry(),
    eventBus,
  );
  const provider = stubProvider();
  notifications.register(provider);

  const orders = { findById: vi.fn() };
  const customers = { findById: vi.fn() };

  const listener = new OrderNotificationsListener(
    eventBus,
    orders as never,
    customers as never,
    notifications,
  );
  listener.onModuleInit();

  return { eventBus, notifications, provider, orders, customers };
}

describe('OrderNotificationsListener (Phase 2 E-03 / E-05)', () => {
  it('sends order.confirmation via the registered provider when OrderCreated fires', async () => {
    const { eventBus, provider, customers } = buildHarness();
    customers.findById.mockResolvedValue({ email: 'buyer@example.com' });

    await eventBus.publish({
      eventName: CoreEventName.OrderCreated,
      aggregateType: 'order',
      aggregateId: 'order-1',
      data: {
        orderId: 'order-1',
        cartId: 'cart-1',
        customerId: 'cust-1',
        status: 'pending',
        currencyCode: 'USD',
        totalMinor: '2500',
        paymentMethod: 'manual',
      },
    });

    expect(customers.findById).toHaveBeenCalledWith('cust-1');
    expect(provider.send).toHaveBeenCalledTimes(1);
    const sent = provider.send.mock.calls[0]![0];
    expect(sent.templateCode).toBe('order.confirmation');
    expect(sent.to).toEqual({ email: 'buyer@example.com' });
    expect(sent.subject).toContain('order-1');
    expect(sent.bodyText).toContain('25.00 USD');
  });

  it('skips OrderCreated when the order has no customerId (guest, no email on file)', async () => {
    const { eventBus, provider } = buildHarness();

    await eventBus.publish({
      eventName: CoreEventName.OrderCreated,
      aggregateType: 'order',
      aggregateId: 'order-2',
      data: {
        orderId: 'order-2',
        cartId: 'cart-2',
        customerId: null,
        status: 'pending',
        currencyCode: 'USD',
        totalMinor: '1000',
        paymentMethod: 'manual',
      },
    });

    expect(provider.send).not.toHaveBeenCalled();
  });

  it('sends payment.captured by resolving the order then the customer email', async () => {
    const { eventBus, provider, orders, customers } = buildHarness();
    orders.findById.mockResolvedValue({ customerId: 'cust-1' });
    customers.findById.mockResolvedValue({ email: 'buyer@example.com' });

    await eventBus.publish({
      eventName: CoreEventName.PaymentCaptured,
      aggregateType: 'payment',
      aggregateId: 'pay-1',
      data: {
        paymentId: 'pay-1',
        orderId: 'order-1',
        providerCode: 'manual',
        amountMinor: '2500',
        currencyCode: 'USD',
        externalId: null,
      },
    });

    expect(orders.findById).toHaveBeenCalledWith('order-1');
    expect(provider.send).toHaveBeenCalledTimes(1);
    const sent = provider.send.mock.calls[0]![0];
    expect(sent.templateCode).toBe('payment.captured');
    expect(sent.to).toEqual({ email: 'buyer@example.com' });
  });

  it('sends payment.failed with the error message from the event', async () => {
    const { eventBus, provider, orders, customers } = buildHarness();
    orders.findById.mockResolvedValue({ customerId: 'cust-1' });
    customers.findById.mockResolvedValue({ email: 'buyer@example.com' });

    await eventBus.publish({
      eventName: CoreEventName.PaymentFailed,
      aggregateType: 'payment',
      aggregateId: 'pay-2',
      data: {
        paymentId: 'pay-2',
        orderId: 'order-1',
        providerCode: 'manual',
        amountMinor: '2500',
        currencyCode: 'USD',
        externalId: null,
        errorMessage: 'card_declined',
      },
    });

    const sent = provider.send.mock.calls[0]![0];
    expect(sent.templateCode).toBe('payment.failed');
    expect(sent.bodyText).toContain('card_declined');
  });

  it('skips payment events gracefully when the order cannot be found', async () => {
    const { eventBus, provider, orders } = buildHarness();
    orders.findById.mockRejectedValue(new Error('not found'));

    await eventBus.publish({
      eventName: CoreEventName.PaymentRefunded,
      aggregateType: 'payment',
      aggregateId: 'pay-3',
      data: {
        paymentId: 'pay-3',
        orderId: 'missing-order',
        providerCode: 'manual',
        amountMinor: '2500',
        currencyCode: 'USD',
        externalId: null,
      },
    });

    expect(provider.send).not.toHaveBeenCalled();
  });
});
