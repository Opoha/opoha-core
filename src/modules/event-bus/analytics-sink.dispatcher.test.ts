import { beforeEach, describe, expect, it } from 'vitest';

import { AnalyticsSinkDispatcher } from './analytics-sink.dispatcher';
import { AnalyticsSinkRegistry } from './analytics-sink.registry';
import { CoreEventName } from './event-catalog';
import { EventBusService } from './event-bus.service';
import type { DomainEvent } from './domain-event';

describe('AnalyticsSinkDispatcher', () => {
  let eventBus: EventBusService;
  let registry: AnalyticsSinkRegistry;

  beforeEach(() => {
    eventBus = new EventBusService();
    registry = new AnalyticsSinkRegistry();
    new AnalyticsSinkDispatcher(eventBus, registry).onModuleInit();
  });

  it('forwards cataloged analytics events to every active sink', async () => {
    const received: DomainEvent[] = [];
    registry.register('plugin-analytics', {
      code: 'memory',
      displayName: 'Memory',
      handle: async (event) => {
        received.push(event);
      },
    });

    await eventBus.publish({
      eventName: CoreEventName.CartLineAdded,
      aggregateType: 'cart',
      aggregateId: 'cart-1',
      data: {
        cartId: 'cart-1',
        lineId: '11111111-1111-1111-1111-111111111111',
        variantId: '22222222-2222-2222-2222-222222222222',
        quantity: 1,
        unitPriceMinor: '100',
        currencyCode: 'USD',
      },
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.eventName).toBe(CoreEventName.CartLineAdded);
  });

  it('does not forward non-cataloged events', async () => {
    const received: DomainEvent[] = [];
    registry.register('plugin-analytics', {
      code: 'memory',
      displayName: 'Memory',
      handle: async (event) => {
        received.push(event);
      },
    });

    await eventBus.publish({
      eventName: CoreEventName.InventoryUpdated,
      aggregateType: 'inventory',
      aggregateId: 'inv-1',
      data: {},
    });

    expect(received).toHaveLength(0);
  });

  it('isolates a failing sink without throwing or blocking other sinks', async () => {
    const received: string[] = [];
    registry.register('plugin-broken', {
      code: 'broken',
      displayName: 'Broken',
      handle: async () => {
        throw new Error('sink boom');
      },
    });
    registry.register('plugin-ok', {
      code: 'ok',
      displayName: 'Ok',
      handle: async (event) => {
        received.push(event.eventName);
      },
    });

    await expect(
      eventBus.publish({
        eventName: CoreEventName.OrderCancelled,
        aggregateType: 'order',
        aggregateId: 'order-1',
        data: { orderId: 'order-1', fromStatus: 'pending' },
      }),
    ).resolves.toBeDefined();

    expect(received).toEqual([CoreEventName.OrderCancelled]);
  });

  it('soft-noops with zero registered sinks', async () => {
    await expect(
      eventBus.publish({
        eventName: CoreEventName.OrderPaid,
        aggregateType: 'order',
        aggregateId: 'order-1',
        data: {
          orderId: 'order-1',
          customerId: null,
          currencyCode: 'USD',
          totalMinor: '100',
          paymentId: 'pay-1',
          providerCode: 'manual',
          amountMinor: '100',
        },
      }),
    ).resolves.toBeDefined();
  });

  it('skips inactive sinks', async () => {
    const received: string[] = [];
    registry.register(
      'plugin-analytics',
      {
        code: 'memory',
        displayName: 'Memory',
        handle: async (event) => {
          received.push(event.eventName);
        },
      },
      false,
    );

    await eventBus.publish({
      eventName: CoreEventName.CheckoutPrepared,
      aggregateType: 'cart',
      aggregateId: 'cart-1',
      data: {
        cartId: 'cart-1',
        customerId: null,
        currencyCode: 'USD',
        subtotalMinor: '100',
        shippingMinor: '0',
        taxMinor: '0',
        discountMinor: '0',
        totalMinor: '100',
        lineCount: 1,
      },
    });

    expect(received).toHaveLength(0);
  });
});
