import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictException, NotFoundException } from '@nestjs/common';

import { RulesService } from './rules.service';

type RuleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  eventName: string;
  conditions: unknown;
  actionRefs: unknown;
  enabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
};

describe('RulesService (C-01/C-03)', () => {
  const now = new Date('2026-08-04T04:00:00Z');
  let rows: RuleRow[];
  let seq = 0;
  let service: RulesService;

  function buildService(): RulesService {
    rows = [];
    seq = 0;
    const repo = {
      find: vi.fn(async (opts?: { where?: Partial<RuleRow>; order?: unknown }) => {
        let list = [...rows];
        if (opts?.where) {
          list = list.filter((row) =>
            Object.entries(opts.where!).every(
              ([k, v]) => row[k as keyof RuleRow] === v,
            ),
          );
        }
        return list.sort(
          (a, b) =>
            a.priority - b.priority || a.code.localeCompare(b.code),
        );
      }),
      findOne: vi.fn(async ({ where }: { where: Partial<RuleRow> }) =>
        rows.find((row) =>
          Object.entries(where).every(
            ([k, v]) => row[k as keyof RuleRow] === v,
          ),
        ) ?? null,
      ),
      create: vi.fn((data: Partial<RuleRow>) => ({
        id: `rule-${++seq}`,
        description: null,
        conditions: null,
        actionRefs: [],
        enabled: true,
        priority: 100,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: RuleRow) => {
        const idx = rows.findIndex((r) => r.id === row.id);
        const saved = { ...row, updatedAt: now };
        if (idx >= 0) {
          rows[idx] = saved;
        } else {
          rows.push(saved);
        }
        return saved;
      }),
      remove: vi.fn(async (row: RuleRow) => {
        rows = rows.filter((r) => r.id !== row.id);
        return row;
      }),
    };
    return new RulesService(repo as never);
  }

  beforeEach(() => {
    service = buildService();
  });

  it('creates a rule with conditions and action refs', async () => {
    const rule = await service.create({
      code: 'tag-usd-paid',
      name: 'Tag USD paid orders',
      eventName: 'OrderPaid',
      conditions: {
        equals: [{ path: 'currencyCode', value: 'USD' }],
      },
      actionRefs: [{ action: 'customer.tag', params: { tag: 'usd-buyer' } }],
      priority: 10,
    });
    expect(rule.code).toBe('tag-usd-paid');
    expect(rule.eventName).toBe('OrderPaid');
    expect(rule.conditions?.equals?.[0]?.value).toBe('USD');
    expect(rule.actionRefs).toEqual([
      { action: 'customer.tag', params: { tag: 'usd-buyer' } },
    ]);
    expect(rule.enabled).toBe(true);
    expect(rule.priority).toBe(10);
  });

  it('rejects duplicate codes', async () => {
    await service.create({
      code: 'dup',
      name: 'One',
      eventName: 'OrderPaid',
    });
    await expect(
      service.create({
        code: 'dup',
        name: 'Two',
        eventName: 'OrderPaid',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('finds enabled rules by event name ordered by priority', async () => {
    await service.create({
      code: 'late',
      name: 'Late',
      eventName: 'OrderPaid',
      priority: 200,
    });
    await service.create({
      code: 'early',
      name: 'Early',
      eventName: 'OrderPaid',
      priority: 5,
    });
    await service.create({
      code: 'other',
      name: 'Other',
      eventName: 'CustomerCreated',
    });
    await service.create({
      code: 'off',
      name: 'Off',
      eventName: 'OrderPaid',
      enabled: false,
    });

    const found = await service.findEnabledByEventName('OrderPaid');
    expect(found.map((r) => r.code)).toEqual(['early', 'late']);
  });

  it('updates and deletes rules', async () => {
    const created = await service.create({
      code: 'tmp',
      name: 'Tmp',
      eventName: 'OrderPaid',
    });
    const updated = await service.update({
      id: created.id,
      name: 'Renamed',
      enabled: false,
    });
    expect(updated.name).toBe('Renamed');
    expect(updated.enabled).toBe(false);

    const removed = await service.remove(created.id);
    expect(removed.id).toBe(created.id);
    await expect(service.findById(created.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
