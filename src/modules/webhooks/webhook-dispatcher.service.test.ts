import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBusService } from '../event-bus/event-bus.service';
import { createDomainEvent } from '../event-bus/domain-event';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import type { WebhooksService } from './webhooks.service';
import type { WebhookDeliveryWorker } from './webhook-delivery.worker';

describe('WebhookDispatcherService (D-03)', () => {
  let attempts: Array<Record<string, unknown>>;
  let dispatcher: WebhookDispatcherService;
  let processDue: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    attempts = [];
    processDue = vi.fn(async () => []);
    const webhooks = {
      findEnabledForEvent: vi.fn(async (eventName: string) => {
        if (eventName !== 'OrderPaid') {
          return [];
        }
        return [
          {
            id: 'ep-1',
            code: 'paid',
            eventNames: ['OrderPaid'],
            enabled: true,
          },
        ];
      }),
    } as unknown as WebhooksService;

    const worker = {
      processDue,
    } as unknown as WebhookDeliveryWorker;

    const attemptRepo = {
      create: vi.fn((data: Record<string, unknown>) => ({
        id: `att-${attempts.length + 1}`,
        ...data,
      })),
      save: vi.fn(async (row: Record<string, unknown>) => {
        attempts.push(row);
        return row;
      }),
    };

    const bus = new EventBusService();
    dispatcher = new WebhookDispatcherService(
      webhooks,
      worker,
      bus,
      attemptRepo as never,
    );
  });

  it('enqueues a delivery for matching endpoints', async () => {
    const event = createDomainEvent({
      eventName: 'OrderPaid',
      aggregateType: 'order',
      aggregateId: 'o-1',
      data: { orderId: 'o-1' },
    });
    const result = await dispatcher.enqueueForEvent(event);
    expect(result.enqueued).toBe(1);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.eventName).toBe('OrderPaid');
    expect(attempts[0]!.status).toBe('pending');
    expect((attempts[0]!.payload as { data: { orderId: string } }).data.orderId).toBe(
      'o-1',
    );
  });

  it('auto-delivers when enabled', async () => {
    dispatcher.setAutoDeliver(true);
    const event = createDomainEvent({
      eventName: 'OrderPaid',
      aggregateType: 'order',
      aggregateId: 'o-2',
      data: {},
    });
    await dispatcher.enqueueForEvent(event);
    expect(processDue).toHaveBeenCalledOnce();
  });

  it('enqueues nothing when no endpoint matches', async () => {
    const event = createDomainEvent({
      eventName: 'CustomerCreated',
      aggregateType: 'customer',
      aggregateId: 'c-1',
      data: {},
    });
    const result = await dispatcher.enqueueForEvent(event);
    expect(result.enqueued).toBe(0);
    expect(attempts).toHaveLength(0);
  });
});
