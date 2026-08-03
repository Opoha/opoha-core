import type { DomainEvent } from '../event-bus/domain-event';

/**
 * Context passed to registered rule action handlers (Phase 8 C-02/C-03).
 */
export type RuleActionContext = {
  /** Rule definition code that matched. */
  ruleCode: string;
  /** Triggering domain event. */
  event: DomainEvent;
  /** Params from the rule's action_refs entry. */
  params: Record<string, unknown>;
};

export type RuleActionHandler = (
  ctx: RuleActionContext,
) => void | Promise<void>;

export type RegisteredRuleAction = {
  /** Registry key (e.g. `customer.tag`). */
  name: string;
  displayName?: string;
  /** Null for core built-ins. */
  pluginId: string | null;
  handler: RuleActionHandler;
  active: boolean;
};

export type RegisterRuleActionInput = {
  name: string;
  displayName?: string;
  handler: RuleActionHandler;
};
