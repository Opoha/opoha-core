import { Injectable } from '@nestjs/common';

import type {
  RegisterRuleActionInput,
  RegisteredRuleAction,
  RuleActionHandler,
} from './rule-action';

/**
 * Registry for rule action handlers.
 * Core built-ins and plugins register; RulesEvaluatorService resolves by name.
 */
@Injectable()
export class RuleActionRegistry {
  private readonly entries: RegisteredRuleAction[] = [];

  register(
    pluginId: string | null,
    input: RegisterRuleActionInput,
    active = true,
  ): RegisteredRuleAction {
    const name = input.name?.trim() ?? '';
    if (!name) {
      throw new Error('Rule action name is required');
    }
    const existing = this.entries.find((e) => e.name === name);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `Rule action conflict: "${name}" already registered` +
          (existing.pluginId ? ` by plugin "${existing.pluginId}"` : ' by core'),
      );
    }
    if (existing) {
      existing.displayName = input.displayName;
      existing.handler = input.handler;
      existing.active = active;
      return existing;
    }
    const entry: RegisteredRuleAction = {
      name,
      displayName: input.displayName,
      pluginId,
      handler: input.handler,
      active,
    };
    this.entries.push(entry);
    return entry;
  }

  get(name: string): RegisteredRuleAction | undefined {
    return this.entries.find((e) => e.name === name && e.active);
  }

  getHandler(name: string): RuleActionHandler | undefined {
    return this.get(name)?.handler;
  }

  list(activeOnly = false): readonly RegisteredRuleAction[] {
    return activeOnly ? this.entries.filter((e) => e.active) : [...this.entries];
  }

  activatePlugin(pluginId: string): void {
    for (const e of this.entries) {
      if (e.pluginId === pluginId) {
        e.active = true;
      }
    }
  }

  deactivatePlugin(pluginId: string): void {
    for (const e of this.entries) {
      if (e.pluginId === pluginId) {
        e.active = false;
      }
    }
  }

  removePlugin(pluginId: string): RegisteredRuleAction[] {
    const removed: RegisteredRuleAction[] = [];
    for (let i = this.entries.length - 1; i >= 0; i -= 1) {
      const entry = this.entries[i];
      if (entry?.pluginId === pluginId) {
        removed.push(entry);
        this.entries.splice(i, 1);
      }
    }
    return removed;
  }

  /** Test helper — clears all registrations. */
  resetForTests(): void {
    this.entries.length = 0;
  }
}
