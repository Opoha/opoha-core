import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDomainEvent } from '../event-bus/domain-event';
import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import {
  customerTagStore,
  notificationEmitStore,
} from './action-stores';
import { RuleActionRegistry } from './rule-action.registry';
import { RulesEvaluatorService } from './rules-evaluator.service';
import type { RulesService } from './rules.service';
import type { RuleDefinitionType } from './rules.types';

describe('RulesEvaluatorService (C-02/C-03)', () => {
  let rulesByEvent: Map<string, RuleDefinitionType[]>;
  let rulesService: RulesService;
  let registry: RuleActionRegistry;
  let eventBus: EventBusService;
  let evaluator: RulesEvaluatorService;

  beforeEach(() => {
    customerTagStore.clear();
    notificationEmitStore.clear();
    rulesByEvent = new Map();
    rulesService = {
      findEnabledByEventName: vi.fn(async (eventName: string) =>
        rulesByEvent.get(eventName) ?? [],
      ),
    } as never;
    registry = new RuleActionRegistry();
    eventBus = new EventBusService();
    evaluator = new RulesEvaluatorService(
      rulesService,
      registry,
      eventBus,
    );
    evaluator.onModuleInit();
  });

  function putRule(partial: Partial<RuleDefinitionType> & {
    code: string;
    eventName: string;
  }): void {
    const rule: RuleDefinitionType = {
      id: `id-${partial.code}`,
      name: partial.name ?? partial.code,
      description: null,
      conditions: null,
      actionRefs: [],
      enabled: true,
      priority: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...partial,
    };
    const list = rulesByEvent.get(rule.eventName) ?? [];
    list.push(rule);
    list.sort((a, b) => a.priority - b.priority);
    rulesByEvent.set(rule.eventName, list);
  }

  it('registers built-in customer.tag and notification.emit', () => {
    expect(registry.get('customer.tag')).toBeDefined();
    expect(registry.get('notification.emit')).toBeDefined();
  });

  it('invokes actions when conditions match on OrderPaid', async () => {
    const customerId = '11111111-1111-1111-1111-111111111111';
    putRule({
      code: 'tag-usd',
      eventName: CoreEventName.OrderPaid,
      conditions: {
        equals: [{ path: 'currencyCode', value: 'USD' }],
      },
      actionRefs: [
        { action: 'customer.tag', params: { tag: 'vip' } },
        {
          action: 'notification.emit',
          params: { channel: 'email', template: 'vip-welcome' },
        },
      ],
    });

    const event = createDomainEvent({
      eventName: CoreEventName.OrderPaid,
      aggregateType: 'order',
      aggregateId: '22222222-2222-2222-2222-222222222222',
      data: {
        orderId: '22222222-2222-2222-2222-222222222222',
        customerId,
        currencyCode: 'USD',
        totalMinor: '1000',
        paymentId: 'pay-1',
        providerCode: 'manual',
        amountMinor: '1000',
      },
    });

    const result = await evaluator.evaluate(event);
    expect(result.matchedRuleCodes).toEqual(['tag-usd']);
    expect(result.actionsInvoked).toEqual([
      'customer.tag',
      'notification.emit',
    ]);
    expect(customerTagStore.list(customerId)).toEqual(['vip']);
    expect(notificationEmitStore.list()).toHaveLength(1);
    expect(notificationEmitStore.list()[0]?.template).toBe('vip-welcome');
  });

  it('skips rules when conditions do not match', async () => {
    putRule({
      code: 'eur-only',
      eventName: CoreEventName.OrderPaid,
      conditions: {
        equals: [{ path: 'currencyCode', value: 'EUR' }],
      },
      actionRefs: [{ action: 'customer.tag', params: { tag: 'eur' } }],
    });

    const event = createDomainEvent({
      eventName: CoreEventName.OrderPaid,
      aggregateType: 'order',
      aggregateId: '22222222-2222-2222-2222-222222222222',
      data: {
        orderId: '22222222-2222-2222-2222-222222222222',
        customerId: '11111111-1111-1111-1111-111111111111',
        currencyCode: 'USD',
        totalMinor: '1000',
        paymentId: 'pay-1',
        providerCode: 'manual',
        amountMinor: '1000',
      },
    });

    const result = await evaluator.evaluate(event);
    expect(result.matchedRuleCodes).toEqual([]);
    expect(customerTagStore.list('11111111-1111-1111-1111-111111111111')).toEqual(
      [],
    );
  });

  it('runs via event bus subscription', async () => {
    putRule({
      code: 'on-customer',
      eventName: CoreEventName.CustomerCreated,
      actionRefs: [
        { action: 'customer.tag', params: { tag: 'new' } },
      ],
    });

    await eventBus.publish({
      eventName: CoreEventName.CustomerCreated,
      aggregateType: 'customer',
      aggregateId: '33333333-3333-3333-3333-333333333333',
      data: {
        customerId: '33333333-3333-3333-3333-333333333333',
        email: 'a@example.com',
      },
    });

    expect(
      customerTagStore.list('33333333-3333-3333-3333-333333333333'),
    ).toEqual(['new']);
  });
});
