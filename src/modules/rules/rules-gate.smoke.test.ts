/**
 * Phase 8 C-04 — Rules gate smoke.
 * A rule persisted via `RulesService` (TypeORM repo, ADR-0010) whose
 * conditions match an incoming cataloged domain event applies its
 * registered action end-to-end through the real event bus. A non-matching
 * rule and a disabled rule must not fire.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDomainEvent } from '../event-bus/domain-event';
import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import {
  customerTagStore,
  notificationEmitStore,
} from './action-stores';
import { RuleActionRegistry } from './rule-action.registry';
import type { RuleActionRef, RuleConditions } from './rule-conditions';
import { RulesEvaluatorService } from './rules-evaluator.service';
import { RulesService } from './rules.service';

type RuleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  eventName: string;
  conditions: RuleConditions | null;
  actionRefs: RuleActionRef[];
  enabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
};

describe('Rules gate smoke (C-04)', () => {
  const now = new Date('2026-08-04T04:00:00Z');
  const customerId = '99999999-9999-4999-8999-999999999999';
  const orderId = '88888888-8888-4888-8888-888888888888';

  let rows: RuleRow[];
  let seq: number;
  let rulesService: RulesService;
  let evaluator: RulesEvaluatorService;
  let eventBus: EventBusService;

  beforeEach(() => {
    customerTagStore.clear();
    notificationEmitStore.clear();
    rows = [];
    seq = 0;

    const repo = {
      find: vi.fn(async ({ where, order: _order }: { where?: Partial<RuleRow>; order?: unknown } = {}) => {
        let list = [...rows];
        if (where) {
          list = list.filter((row) =>
            Object.entries(where).every(
              ([k, v]) => row[k as keyof RuleRow] === v,
            ),
          );
        }
        return list.sort(
          (a, b) => a.priority - b.priority || a.code.localeCompare(b.code),
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
    };

    rulesService = new RulesService(repo as never);
    eventBus = new EventBusService();
    evaluator = new RulesEvaluatorService(
      rulesService,
      new RuleActionRegistry(),
      eventBus,
    );
    evaluator.onModuleInit();
  });

  it('condition match on OrderPaid applies registered actions via the event bus', async () => {
    await rulesService.create({
      code: 'tag-vip-usd-orders',
      name: 'Tag VIP on USD order paid',
      eventName: CoreEventName.OrderPaid,
      conditions: {
        equals: [{ path: 'currencyCode', value: 'USD' }],
      },
      actionRefs: [
        { action: 'customer.tag', params: { tag: 'vip' } },
        {
          action: 'notification.emit',
          params: { channel: 'email', template: 'order.paid.vip' },
        },
      ],
      priority: 10,
    });

    // Non-matching currency — must not fire.
    await rulesService.create({
      code: 'tag-eur-orders',
      name: 'Tag EUR order paid',
      eventName: CoreEventName.OrderPaid,
      conditions: {
        equals: [{ path: 'currencyCode', value: 'EUR' }],
      },
      actionRefs: [{ action: 'customer.tag', params: { tag: 'eur' } }],
    });

    // Disabled rule with matching conditions — must not fire.
    await rulesService.create({
      code: 'disabled-usd-orders',
      name: 'Disabled USD rule',
      eventName: CoreEventName.OrderPaid,
      conditions: {
        equals: [{ path: 'currencyCode', value: 'USD' }],
      },
      actionRefs: [{ action: 'customer.tag', params: { tag: 'disabled' } }],
      enabled: false,
    });

    expect(customerTagStore.list(customerId)).toEqual([]);
    expect(notificationEmitStore.list()).toEqual([]);

    const event = createDomainEvent({
      eventName: CoreEventName.OrderPaid,
      aggregateType: 'order',
      aggregateId: orderId,
      data: {
        orderId,
        customerId,
        currencyCode: 'USD',
        totalMinor: '5000',
        paymentId: 'pay-gate-1',
        providerCode: 'manual',
        amountMinor: '5000',
      },
    });

    const publishResult = await eventBus.publish(event);

    expect(publishResult.failures).toEqual([]);
    expect(customerTagStore.list(customerId)).toEqual(['vip']);
    expect(notificationEmitStore.list()).toEqual([
      expect.objectContaining({
        ruleCode: 'tag-vip-usd-orders',
        channel: 'email',
        template: 'order.paid.vip',
        customerId,
        eventName: CoreEventName.OrderPaid,
      }),
    ]);

    // Enabled rules are queryable regardless of condition outcome; the
    // disabled rule is excluded from the enabled set entirely.
    const persisted = await rulesService.findEnabledByEventName(
      CoreEventName.OrderPaid,
    );
    expect(persisted.map((r) => r.code).sort()).toEqual([
      'tag-eur-orders',
      'tag-vip-usd-orders',
    ]);
  });

  it('unknown action reference is skipped and observable, not a hard failure', async () => {
    await rulesService.create({
      code: 'unknown-action-rule',
      name: 'References an unregistered action',
      eventName: CoreEventName.CustomerCreated,
      actionRefs: [{ action: 'nonexistent.action' }],
    });

    const result = await evaluator.onEvent(
      createDomainEvent({
        eventName: CoreEventName.CustomerCreated,
        aggregateType: 'customer',
        aggregateId: customerId,
        data: { customerId, email: 'gate@example.com' },
      }),
    );

    expect(result.matchedRuleCodes).toEqual(['unknown-action-rule']);
    expect(result.actionsInvoked).toEqual([]);
    expect(result.skippedActions).toEqual(['nonexistent.action']);
  });
});
