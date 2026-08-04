import { Injectable, OnModuleInit, Optional } from '@nestjs/common';

import { CoreEventName } from '../event-bus/event-catalog';
import type { DomainEvent } from '../event-bus/domain-event';
import { EventBusService } from '../event-bus/event-bus.service';
import { AppLogger } from '../logging/app-logger';
import { evaluateRuleConditions } from './rule-conditions';
import { RuleActionRegistry } from './rule-action.registry';
import { registerBuiltInRuleActions } from './built-in-actions';
import { RulesService } from './rules.service';

/**
 * Cataloged cart / order / customer events that the rule evaluator
 * listens on. Rules with other event names still persist
 * but are not auto-subscribed until listed here.
 */
export const RULE_TRIGGER_EVENTS: readonly string[] = [
  CoreEventName.CartCreated,
  CoreEventName.CartLineAdded,
  CoreEventName.CartLineUpdated,
  CoreEventName.CartLineRemoved,
  CoreEventName.CheckoutPrepared,
  CoreEventName.OrderCreated,
  CoreEventName.OrderPaid,
  CoreEventName.OrderStatusChanged,
  CoreEventName.CustomerCreated,
];

export type RuleEvaluationResult = {
  eventName: string;
  matchedRuleCodes: string[];
  actionsInvoked: string[];
  skippedActions: string[];
};

/**
 * Subscribes to cataloged events, evaluates enabled rules, invokes actions.
 */
@Injectable()
export class RulesEvaluatorService implements OnModuleInit {
  private readonly unsubscribers: Array<() => void> = [];

  constructor(
    private readonly rules: RulesService,
    private readonly actions: RuleActionRegistry,
    private readonly eventBus: EventBusService,
    @Optional() private readonly logger?: AppLogger,
  ) {}

  onModuleInit(): void {
    registerBuiltInRuleActions(this.actions);
    for (const eventName of RULE_TRIGGER_EVENTS) {
      const unsub = this.eventBus.subscribe(
        eventName,
        async (event) => {
          await this.onEvent(event);
        },
        { id: `rules-evaluator:${eventName}` },
      );
      this.unsubscribers.push(unsub);
    }
  }

  /** Detach listeners (tests). */
  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
  }

  async onEvent(event: DomainEvent): Promise<RuleEvaluationResult> {
    return this.evaluate(event);
  }

  async evaluate(event: DomainEvent): Promise<RuleEvaluationResult> {
    const matchedRuleCodes: string[] = [];
    const actionsInvoked: string[] = [];
    const skippedActions: string[] = [];

    const enabled = await this.rules.findEnabledByEventName(event.eventName);
    for (const rule of enabled) {
      if (!evaluateRuleConditions(rule.conditions, event.data)) {
        continue;
      }
      matchedRuleCodes.push(rule.code);
      for (const ref of rule.actionRefs) {
        const reg = this.actions.get(ref.action);
        if (!reg) {
          skippedActions.push(ref.action);
          this.logger?.warn(
            `Rule "${rule.code}" references unknown action "${ref.action}"`,
            'RulesEvaluatorService',
          );
          continue;
        }
        await reg.handler({
          ruleCode: rule.code,
          event,
          params: ref.params ?? {},
        });
        actionsInvoked.push(ref.action);
      }
    }

    return {
      eventName: event.eventName,
      matchedRuleCodes,
      actionsInvoked,
      skippedActions,
    };
  }
}
