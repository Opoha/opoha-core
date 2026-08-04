import type { RuleActionRegistry } from './rule-action.registry';
import { customerTagStore, notificationEmitStore } from './action-stores';

/**
 * Registers core built-in rule actions (Phase 8 C-03).
 * - `customer.tag` — tags customerId from event data (in-memory stub)
 * - `notification.emit` — records a notification stub for observability
 */
export function registerBuiltInRuleActions(registry: RuleActionRegistry): void {
  registry.register(null, {
    name: 'customer.tag',
    displayName: 'Tag customer',
    handler: async (ctx) => {
      const data = ctx.event.data as Record<string, unknown> | null;
      const customerId = typeof data?.customerId === 'string' ? data.customerId : null;
      const tag = typeof ctx.params.tag === 'string' ? ctx.params.tag : null;
      if (!customerId || !tag) {
        return;
      }
      customerTagStore.add(customerId, tag);
    },
  });

  registry.register(null, {
    name: 'notification.emit',
    displayName: 'Emit notification (stub)',
    handler: async (ctx) => {
      const data = ctx.event.data as Record<string, unknown> | null;
      const customerId = typeof data?.customerId === 'string' ? data.customerId : null;
      const channel = typeof ctx.params.channel === 'string' ? ctx.params.channel : 'email';
      const template =
        typeof ctx.params.template === 'string' ? ctx.params.template : 'rule.notification';
      notificationEmitStore.push({
        ruleCode: ctx.ruleCode,
        channel,
        template,
        customerId,
        eventName: ctx.event.eventName,
        at: new Date(),
      });
    },
  });
}
