import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictException, NotFoundException } from '@nestjs/common';

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
  status: string;
  attempt: number;
  nextAttemptAt: Date | null;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  signature: string | null;
  finishedAt: Date | null;
  createdAt: Date;
};

describe('WebhooksService (D-01/D-03)', () => {
  const now = new Date('2026-08-04T04:00:00Z');
  let endpoints: EndpointRow[];
  let attempts: AttemptRow[];
  let seq = 0;
  let service: WebhooksService;

  function buildService(): WebhooksService {
    endpoints = [];
    attempts = [];
    seq = 0;
    const endpointRepo = {
      find: vi.fn(async (opts?: { where?: Partial<EndpointRow> }) => {
        let list = [...endpoints];
        if (opts?.where) {
          list = list.filter((row) =>
            Object.entries(opts.where!).every(([k, v]) => row[k as keyof EndpointRow] === v),
          );
        }
        return list.sort((a, b) => a.code.localeCompare(b.code));
      }),
      findOne: vi.fn(
        async ({ where }: { where: Partial<EndpointRow> }) =>
          endpoints.find((row) =>
            Object.entries(where).every(([k, v]) => row[k as keyof EndpointRow] === v),
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
    };
    return new WebhooksService(endpointRepo as never, attemptRepo as never);
  }

  beforeEach(() => {
    service = buildService();
  });

  it('creates an endpoint and returns plaintext secret once', async () => {
    const ep = await service.create({
      code: 'order-paid-hook',
      name: 'Order paid',
      url: 'https://example.com/hooks',
      secret: 'super-secret-key',
      eventNames: ['OrderPaid'],
    });
    expect(ep.code).toBe('order-paid-hook');
    expect(ep.secret).toBe('super-secret-key');
    expect(ep.eventNames).toEqual(['OrderPaid']);
  });

  it('masks secret on list/read', async () => {
    await service.create({
      code: 'hook-a',
      name: 'A',
      url: 'https://example.com/a',
      secret: 'super-secret-key',
      eventNames: ['OrderPaid'],
    });
    const listed = await service.findAll();
    expect(listed[0]?.secret).toBe('***');
  });

  it('rejects duplicate codes', async () => {
    await service.create({
      code: 'dup',
      name: 'One',
      url: 'https://example.com/1',
      secret: 'super-secret-key',
      eventNames: [],
    });
    await expect(
      service.create({
        code: 'dup',
        name: 'Two',
        url: 'https://example.com/2',
        secret: 'super-secret-key',
        eventNames: [],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('findEnabledForEvent filters by subscription', async () => {
    await service.create({
      code: 'paid',
      name: 'Paid',
      url: 'https://example.com/paid',
      secret: 'super-secret-key',
      eventNames: ['OrderPaid'],
    });
    await service.create({
      code: 'created',
      name: 'Created',
      url: 'https://example.com/created',
      secret: 'super-secret-key',
      eventNames: ['OrderCreated'],
      enabled: true,
    });
    const matched = await service.findEnabledForEvent('OrderPaid');
    expect(matched.map((e) => e.code)).toEqual(['paid']);
  });

  it('throws when endpoint missing', async () => {
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
