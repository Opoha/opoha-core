/**
 * Phase 8 D-04 — Webhooks gate smoke.
 * Persist a webhook endpoint (TypeORM repo, ADR-0010), publish a cataloged
 * domain event through the real event bus → dispatcher enqueues a delivery →
 * worker posts an HMAC-SHA256-signed payload. Transient HTTP failure retries
 * then succeeds; exhausted retries dead-letter.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDomainEvent } from '../event-bus/domain-event';
import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { WebhookDeliveryWorker } from './webhook-delivery.worker';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import type { WebhookHttpClient } from './webhook-http.client';
import {
  signWebhookPayload,
  verifyWebhookSignature,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
} from './webhook-signing';
import type { WebhookDeliveryStatus } from './webhook-status';
import { WebhooksService } from './webhooks.service';

type EndpointRow = {
  id: string;
  code: string;
  name: string;
  url: string;
  secret: string;
  eventNames: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AttemptRow = {
  id: string;
  endpointId: string;
  eventName: string;
  eventId: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempt: number;
  nextAttemptAt: Date | null;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  signature: string | null;
  finishedAt: Date | null;
  createdAt: Date;
};

describe('Webhooks gate smoke (D-04)', () => {
  const now = new Date('2026-08-04T06:00:00Z');
  const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const secret = 'gate-webhook-secret';

  let endpoints: EndpointRow[];
  let attempts: AttemptRow[];
  let seq: number;
  let httpCalls: Array<{
    url: string;
    headers: Record<string, string>;
    body: string;
  }>;
  let statusSequence: number[];
  let webhooks: WebhooksService;
  let worker: WebhookDeliveryWorker;
  let dispatcher: WebhookDispatcherService;
  let eventBus: EventBusService;

  beforeEach(() => {
    endpoints = [];
    attempts = [];
    seq = 0;
    httpCalls = [];
    statusSequence = [500, 200];

    const endpointRepo = {
      find: vi.fn(async (opts?: { where?: Partial<EndpointRow> }) => {
        let list = [...endpoints];
        if (opts?.where) {
          list = list.filter((row) =>
            Object.entries(opts.where!).every(
              ([k, v]) => row[k as keyof EndpointRow] === v,
            ),
          );
        }
        return list.sort((a, b) => a.code.localeCompare(b.code));
      }),
      findOne: vi.fn(async ({ where }: { where: Partial<EndpointRow> }) =>
        endpoints.find((row) =>
          Object.entries(where).every(
            ([k, v]) => row[k as keyof EndpointRow] === v,
          ),
        ) ?? null,
      ),
      create: vi.fn((data: Partial<EndpointRow>) => ({
        id: `ep-${++seq}`,
        enabled: true,
        eventNames: [],
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: EndpointRow) => {
        const idx = endpoints.findIndex((r) => r.id === row.id);
        const saved = { ...row, updatedAt: now };
        if (idx >= 0) {
          endpoints[idx] = saved;
        } else {
          endpoints.push(saved);
        }
        return saved;
      }),
      remove: vi.fn(async (row: EndpointRow) => {
        endpoints = endpoints.filter((r) => r.id !== row.id);
        return row;
      }),
    };

    const attemptRepo = {
      create: vi.fn((data: Partial<AttemptRow>) => ({
        id: `att-${++seq}`,
        createdAt: now,
        ...data,
      })),
      save: vi.fn(async (row: AttemptRow) => {
        const idx = attempts.findIndex((a) => a.id === row.id);
        if (idx >= 0) {
          attempts[idx] = { ...row };
        } else {
          attempts.push({ ...row });
        }
        return row;
      }),
      find: vi.fn(async (opts?: { where?: Partial<AttemptRow>; take?: number }) => {
        let list = [...attempts];
        if (opts?.where?.endpointId) {
          list = list.filter((r) => r.endpointId === opts.where!.endpointId);
        }
        list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        if (opts?.take) {
          list = list.slice(0, opts.take);
        }
        return list;
      }),
      findOne: vi.fn(),
      createQueryBuilder: vi.fn(() => {
        const qb = {
          where: vi.fn(() => qb),
          andWhere: vi.fn(() => qb),
          orderBy: vi.fn(() => qb),
          take: vi.fn(() => qb),
          getMany: vi.fn(async () =>
            attempts.filter(
              (a) =>
                (a.status === 'pending' || a.status === 'failed') &&
                (a.nextAttemptAt === null || a.nextAttemptAt <= now),
            ),
          ),
        };
        return qb;
      }),
    };

    const http: WebhookHttpClient = {
      post: vi.fn(async (req) => {
        httpCalls.push({
          url: req.url,
          headers: req.headers,
          body: req.body,
        });
        const status = statusSequence.shift() ?? 200;
        return {
          status,
          body: status >= 200 && status < 300 ? 'ok' : 'err',
        };
      }),
    };

    webhooks = new WebhooksService(endpointRepo as never, attemptRepo as never);
    worker = new WebhookDeliveryWorker(
      attemptRepo as never,
      endpointRepo as never,
      http,
    ).configure({ maxAttempts: 3, backoffMs: [0, 0, 0] });
    eventBus = new EventBusService();
    dispatcher = new WebhookDispatcherService(
      webhooks,
      worker,
      eventBus,
      attemptRepo as never,
    );
    dispatcher.onModuleInit();
  });

  it('OrderPaid → signed delivery with retry-on-failure then success', async () => {
    const endpoint = await webhooks.create({
      code: 'order-paid-gate',
      name: 'Order paid gate hook',
      url: 'https://hooks.example.com/opoha-gate',
      secret,
      eventNames: [CoreEventName.OrderPaid],
    });

    // Unrelated event subscription — must not enqueue for OrderPaid.
    await webhooks.create({
      code: 'customer-created-only',
      name: 'Customer only',
      url: 'https://hooks.example.com/customers',
      secret: 'other-secret-key',
      eventNames: [CoreEventName.CustomerCreated],
    });

    const event = createDomainEvent({
      eventName: CoreEventName.OrderPaid,
      aggregateType: 'order',
      aggregateId: orderId,
      data: {
        orderId,
        currencyCode: 'USD',
        totalMinor: '2500',
      },
    });

    const publishResult = await eventBus.publish(event);
    expect(publishResult.failures).toEqual([]);

    // Dispatcher enqueued one attempt for the matching endpoint only.
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.endpointId).toBe(endpoint.id);
    expect(attempts[0]!.status).toBe('pending');
    expect(attempts[0]!.eventName).toBe(CoreEventName.OrderPaid);

    // First delivery fails (HTTP 500) → retry scheduled.
    const first = await worker.processDue(now);
    expect(first).toHaveLength(1);
    expect(first[0]!.status).toBe('failed');
    expect(attempts[0]!.status).toBe('failed');
    expect(attempts[0]!.attempt).toBe(2);
    expect(httpCalls).toHaveLength(1);

    const body1 = httpCalls[0]!.body;
    const sig1 = httpCalls[0]!.headers[WEBHOOK_SIGNATURE_HEADER]!;
    expect(verifyWebhookSignature(secret, body1, sig1)).toBe(true);
    expect(sig1).toBe(signWebhookPayload(secret, body1));
    expect(httpCalls[0]!.headers[WEBHOOK_EVENT_HEADER]).toBe(
      CoreEventName.OrderPaid,
    );
    expect(JSON.parse(body1)).toEqual(
      expect.objectContaining({
        eventName: CoreEventName.OrderPaid,
        aggregateId: orderId,
        data: expect.objectContaining({ orderId }),
      }),
    );

    // Retry succeeds (HTTP 200) with the same signing contract.
    const second = await worker.processDue(now);
    expect(second).toHaveLength(1);
    expect(second[0]!.status).toBe('succeeded');
    expect(attempts[0]!.status).toBe('succeeded');
    expect(attempts[0]!.responseStatus).toBe(200);
    expect(httpCalls).toHaveLength(2);

    const body2 = httpCalls[1]!.body;
    const sig2 = httpCalls[1]!.headers[WEBHOOK_SIGNATURE_HEADER]!;
    expect(verifyWebhookSignature(secret, body2, sig2)).toBe(true);
    expect(attempts[0]!.signature).toBe(sig2);

    const logs = await webhooks.listDeliveryAttempts(endpoint.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe('succeeded');
  });

  it('exhausted retries dead-letter the delivery attempt', async () => {
    statusSequence = [503, 503, 503];

    await webhooks.create({
      code: 'dead-letter-gate',
      name: 'Always fails',
      url: 'https://hooks.example.com/fail',
      secret,
      eventNames: [CoreEventName.OrderPaid],
    });

    await dispatcher.enqueueForEvent(
      createDomainEvent({
        eventName: CoreEventName.OrderPaid,
        aggregateType: 'order',
        aggregateId: orderId,
        data: { orderId },
      }),
    );

    expect(attempts).toHaveLength(1);

    await worker.processDue(now); // attempt 1 → failed (2)
    await worker.processDue(now); // attempt 2 → failed (3)
    const last = await worker.processDue(now); // attempt 3 → dead_letter
    expect(last[0]!.status).toBe('dead_letter');
    expect(attempts[0]!.status).toBe('dead_letter');
    expect(attempts[0]!.attempt).toBe(3);
    expect(httpCalls).toHaveLength(3);
  });
});
