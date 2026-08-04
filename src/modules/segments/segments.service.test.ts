import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBusService } from '../event-bus/event-bus.service';
import { CoreEventName } from '../event-bus/event-catalog';
import { CustomerSegmentEntity } from './entities/customer-segment.entity';
import { segmentEventSchemas } from './events/segment-events';
import { SegmentsService } from './segments.service';
import type { SegmentRules } from './segment-rules';

type SegmentRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  rules: SegmentRules | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError('INSERT', [], { code: '23505' } as never);
}

describe('SegmentsService (unit)', () => {
  const now = new Date('2026-08-03T18:00:00Z');
  let store: SegmentRow[];
  let service: SegmentsService;
  let published: Array<{ eventName: string; data: Record<string, unknown> }>;

  beforeEach(() => {
    store = [];
    published = [];
    let seq = 0;

    const eventBus = new EventBusService();
    for (const { eventName, schema } of segmentEventSchemas()) {
      eventBus.registerSchema(eventName, schema);
    }
    eventBus.subscribe(CoreEventName.SegmentUpdated, (e) => {
      published.push({ eventName: e.eventName, data: e.data as never });
    });

    const repo = {
      find: vi.fn(
        async ({
          where,
        }: {
          where?: Partial<SegmentRow>;
          order?: unknown;
        } = {}) => {
          let rows = [...store];
          if (where?.isActive !== undefined) {
            rows = rows.filter((r) => r.isActive === where.isActive);
          }
          return rows
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((r) => Object.assign(new CustomerSegmentEntity(), r));
        },
      ),
      findOne: vi.fn(async ({ where }: { where: Partial<SegmentRow> }) => {
        const row = store.find(
          (r) => (where.id && r.id === where.id) || (where.code && r.code === where.code),
        );
        return row ? Object.assign(new CustomerSegmentEntity(), row) : null;
      }),
      create: vi.fn((data: Partial<SegmentRow>) => ({
        id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(++seq).padStart(12, '0')}`,
        description: null,
        rules: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: SegmentRow) => {
        const idx = store.findIndex((r) => r.id === row.id);
        if (idx >= 0) {
          if (store.some((r) => r.code === row.code && r.id !== row.id)) {
            throw uniqueViolation();
          }
          store[idx] = { ...row, updatedAt: now };
          return Object.assign(new CustomerSegmentEntity(), store[idx]);
        }
        if (store.some((r) => r.code === row.code)) {
          throw uniqueViolation();
        }
        const created = { ...row, createdAt: now, updatedAt: now };
        store.push(created);
        return Object.assign(new CustomerSegmentEntity(), created);
      }),
      remove: vi.fn(async (row: SegmentRow) => {
        store = store.filter((r) => r.id !== row.id);
        return row;
      }),
    };

    service = new SegmentsService(repo as never, eventBus);
  });

  it('creates, updates, and lists segments', async () => {
    const created = await service.create({
      code: 'VIP-Buyers',
      name: 'VIP buyers',
      rules: { tags: { any: ['vip'] }, orderCount: { min: 3 } },
    });
    expect(created.code).toBe('vip-buyers');
    expect(created.rules?.orderCount?.min).toBe(3);
    expect(published).toHaveLength(1);
    expect(published[0]?.eventName).toBe(CoreEventName.SegmentUpdated);

    const updated = await service.update({
      id: created.id,
      name: 'VIP buyers (updated)',
      isActive: false,
    });
    expect(updated.name).toBe('VIP buyers (updated)');
    expect(updated.isActive).toBe(false);
    expect(published).toHaveLength(2);

    expect(await service.findAll()).toHaveLength(1);
    expect(await service.findActive()).toHaveLength(0);
  });

  it('rejects duplicate codes and invalid code shape', async () => {
    await service.create({ code: 'vip', name: 'VIP' });
    await expect(service.create({ code: 'VIP', name: 'Again' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.create({ code: 'Bad Code!', name: 'x' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('evaluates membership against stored rules (E-02)', async () => {
    const vip = await service.create({
      code: 'vip',
      name: 'VIP',
      rules: { tags: { any: ['vip'] }, orderCount: { min: 2 } },
    });
    await service.create({
      code: 'big-spenders',
      name: 'Big spenders',
      rules: { spendMinor: { min: '100000' } },
    });

    const ctx = {
      customerId: '11111111-1111-4111-8111-111111111111',
      tags: ['vip'],
      orderCount: 5,
      spendMinor: '500',
    };

    expect(await service.customerMatchesSegment(vip.id, ctx)).toBe(true);
    const matches = await service.listMatchingSegments(ctx);
    expect(matches.map((s) => s.code)).toEqual(['vip']);

    await expect(
      service.customerMatchesSegment('99999999-9999-4999-8999-999999999999', ctx),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('inactive segments never match', async () => {
    const seg = await service.create({
      code: 'paused',
      name: 'Paused',
      rules: null,
      isActive: false,
    });
    expect(
      await service.customerMatchesSegment(seg.id, {
        customerId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toBe(false);
    expect(
      await service.listMatchingSegments({
        customerId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toEqual([]);
  });
});
