import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WebhookDeliveryWorker } from './webhook-delivery.worker';
import type { WebhookHttpClient } from './webhook-http.client';
import { signWebhookPayload, WEBHOOK_SIGNATURE_HEADER } from './webhook-signing';
import type { WebhookDeliveryStatus } from './webhook-status';

type EndpointRow = {
  id: string;
  url: string;
  secret: string;
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

describe('WebhookDeliveryWorker (D-02)', () => {
  const now = new Date('2026-08-04T05:00:00Z');
  let endpoints: EndpointRow[];
  let attempts: AttemptRow[];
  let httpCalls: Array<{ url: string; headers: Record<string, string>; body: string }>;
  let http: WebhookHttpClient;
  let statusSequence: number[];

  function buildWorker(): WebhookDeliveryWorker {
    endpoints = [
      {
        id: 'ep-1',
        url: 'https://hooks.example.com/opoha',
        secret: 'webhook-secret-1',
      },
    ];
    attempts = [];
    httpCalls = [];
    statusSequence = [500, 500, 200];

    http = {
      post: vi.fn(async (req) => {
        httpCalls.push({
          url: req.url,
          headers: req.headers,
          body: req.body,
        });
        const status = statusSequence.shift() ?? 200;
        return { status, body: status >= 200 && status < 300 ? 'ok' : 'err' };
      }),
    };

    const attemptRepo = {
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
      findOne: vi.fn(),
      save: vi.fn(async (row: AttemptRow) => {
        const idx = attempts.findIndex((a) => a.id === row.id);
        if (idx >= 0) {
          attempts[idx] = { ...row };
        } else {
          attempts.push({ ...row });
        }
        return row;
      }),
    };

    const endpointRepo = {
      findOne: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          endpoints.find((e) => e.id === where.id) ?? null,
      ),
    };

    return new WebhookDeliveryWorker(attemptRepo as never, endpointRepo as never, http).configure({
      maxAttempts: 3,
      backoffMs: [0, 0, 0],
    });
  }

  let worker: WebhookDeliveryWorker;

  beforeEach(() => {
    worker = buildWorker();
  });

  it('signs payload and succeeds on 2xx', async () => {
    statusSequence = [200];
    const row: AttemptRow = {
      id: 'att-1',
      endpointId: 'ep-1',
      eventName: 'OrderPaid',
      eventId: 'evt-1',
      payload: { eventName: 'OrderPaid', data: { orderId: 'o1' } },
      status: 'pending',
      attempt: 1,
      nextAttemptAt: now,
      responseStatus: null,
      responseBody: null,
      errorMessage: null,
      signature: null,
      finishedAt: null,
      createdAt: now,
    };
    attempts.push(row);

    const result = await worker.deliverAttempt(row, now);
    expect(result.status).toBe('succeeded');
    expect(httpCalls).toHaveLength(1);
    const expectedSig = signWebhookPayload('webhook-secret-1', httpCalls[0]!.body);
    expect(httpCalls[0]!.headers[WEBHOOK_SIGNATURE_HEADER]).toBe(expectedSig);
    expect(attempts[0]!.status).toBe('succeeded');
    expect(attempts[0]!.signature).toBe(expectedSig);
  });

  it('retries on failure then succeeds', async () => {
    statusSequence = [500, 200];
    const row: AttemptRow = {
      id: 'att-2',
      endpointId: 'ep-1',
      eventName: 'OrderPaid',
      eventId: 'evt-2',
      payload: { eventName: 'OrderPaid', data: {} },
      status: 'pending',
      attempt: 1,
      nextAttemptAt: now,
      responseStatus: null,
      responseBody: null,
      errorMessage: null,
      signature: null,
      finishedAt: null,
      createdAt: now,
    };
    attempts.push(row);

    const first = await worker.deliverAttempt(row, now);
    expect(first.status).toBe('failed');
    expect(attempts[0]!.attempt).toBe(2);
    expect(attempts[0]!.status).toBe('failed');

    const second = await worker.deliverAttempt(attempts[0]!, now);
    expect(second.status).toBe('succeeded');
    expect(attempts[0]!.status).toBe('succeeded');
  });

  it('dead-letters after max attempts', async () => {
    statusSequence = [500, 500, 500];
    const row: AttemptRow = {
      id: 'att-3',
      endpointId: 'ep-1',
      eventName: 'OrderPaid',
      eventId: 'evt-3',
      payload: { eventName: 'OrderPaid', data: {} },
      status: 'pending',
      attempt: 1,
      nextAttemptAt: now,
      responseStatus: null,
      responseBody: null,
      errorMessage: null,
      signature: null,
      finishedAt: null,
      createdAt: now,
    };
    attempts.push(row);

    await worker.deliverAttempt(row, now); // → failed attempt 2
    await worker.deliverAttempt(attempts[0]!, now); // → failed attempt 3
    const last = await worker.deliverAttempt(attempts[0]!, now);
    expect(last.status).toBe('dead_letter');
    expect(attempts[0]!.status).toBe('dead_letter');
    expect(attempts[0]!.attempt).toBe(3);
  });
});
