import { describe, expect, it, vi } from 'vitest';

import { EventBusService } from '../../event-bus/event-bus.service';
import { CoreEventName } from '../../event-bus/event-catalog';
import { orderEventSchemas } from './order-events';
import { OrderPaidAnalyticsListener } from './order-paid-analytics.listener';

describe('OrderPaidAnalyticsListener (F-02)', () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const paymentId = 'pay-1';
  const customerId = '22222222-2222-4222-8222-222222222222';

  it('bridges PaymentCaptured → OrderPaid and skips duplicate paymentId', async () => {
    const eventBus = new EventBusService();
    for (const { eventName, schema } of orderEventSchemas()) {
      eventBus.registerSchema(eventName, schema);
    }

    const orders = {
      findOne: vi.fn(async () => ({
        id: orderId,
        customerId,
        currencyCode: 'USD',
        totalMinor: '5000',
      })),
    };

    const orderPaid: Array<{
      eventName: string;
      data: Record<string, unknown>;
    }> = [];
    eventBus.subscribe(CoreEventName.OrderPaid, (event) => {
      orderPaid.push({
        eventName: event.eventName,
        data: event.data as Record<string, unknown>,
      });
    });

    const listener = new OrderPaidAnalyticsListener(
      eventBus,
      orders as never,
    );
    listener.onModuleInit();

    const paymentPayload = {
      paymentId,
      orderId,
      providerCode: 'manual',
      amountMinor: '5000',
      currencyCode: 'USD',
      externalId: null,
    };

    await eventBus.publish({
      eventName: CoreEventName.PaymentCaptured,
      aggregateType: 'payment',
      aggregateId: paymentId,
      data: paymentPayload,
    });
    await eventBus.publish({
      eventName: CoreEventName.PaymentCaptured,
      aggregateType: 'payment',
      aggregateId: paymentId,
      data: paymentPayload,
    });

    expect(orderPaid).toHaveLength(1);
    expect(orderPaid[0]?.data).toMatchObject({
      orderId,
      customerId,
      paymentId,
      totalMinor: '5000',
      amountMinor: '5000',
      providerCode: 'manual',
    });
  });
});
