import { Injectable } from '@nestjs/common';

import type { EventListener, SubscribeOptions } from '../event-bus/domain-event';
import { EventBusService } from '../event-bus/event-bus.service';

export type GraphQLContribution = {
  pluginId: string;
  /** Logical name for conflict detection (e.g. query field). */
  name: string;
  kind: 'type' | 'query' | 'mutation' | 'resolver';
  /** Opaque descriptor — Nest wiring lands with sample plugin (D-11). */
  descriptor?: unknown;
  active: boolean;
};

export type ProviderContribution = {
  pluginId: string;
  /** Unique token string within the plugin (and globally for conflict checks). */
  token: string;
  provider: unknown;
  active: boolean;
};

export type ListenerContribution = {
  pluginId: string;
  eventName: string;
  listenerId: string;
  active: boolean;
};

type StoredListener = ListenerContribution & {
  handler: EventListener;
  options: SubscribeOptions;
  unsubscribe?: () => void;
};

/**
 * Host-side registration surfaces for GraphQL descriptors, DI providers, and event listeners.
 * Disabled plugins keep records but deactivate runtime wiring (AC-MVP-025).
 */
@Injectable()
export class ContributionRegistry {
  private readonly graphql: GraphQLContribution[] = [];
  private readonly providers: ProviderContribution[] = [];
  private readonly listeners: StoredListener[] = [];

  constructor(private readonly eventBus: EventBusService) {}

  registerGraphQL(contribution: Omit<GraphQLContribution, 'active'> & { active?: boolean }): void {
    const existing = this.graphql.find(
      (g) => g.name === contribution.name && g.kind === contribution.kind,
    );
    if (existing && existing.pluginId !== contribution.pluginId) {
      throw new Error(
        `GraphQL contribution conflict: ${contribution.kind} "${contribution.name}" already registered by plugin "${existing.pluginId}"`,
      );
    }
    if (existing) {
      existing.descriptor = contribution.descriptor;
      existing.active = contribution.active ?? true;
      return;
    }
    this.graphql.push({
      ...contribution,
      active: contribution.active ?? true,
    });
  }

  registerProvider(
    contribution: Omit<ProviderContribution, 'active'> & { active?: boolean },
  ): void {
    const existing = this.providers.find((p) => p.token === contribution.token);
    if (existing && existing.pluginId !== contribution.pluginId) {
      throw new Error(
        `DI provider conflict: token "${contribution.token}" already registered by plugin "${existing.pluginId}"`,
      );
    }
    if (existing) {
      existing.provider = contribution.provider;
      existing.active = contribution.active ?? true;
      return;
    }
    this.providers.push({
      ...contribution,
      active: contribution.active ?? true,
    });
  }

  registerListener(
    pluginId: string,
    eventName: string,
    handler: EventListener,
    options: SubscribeOptions = {},
    active = true,
  ): void {
    const listenerId = options.id ?? `${pluginId}:${eventName}:${this.listeners.length + 1}`;
    const stored: StoredListener = {
      pluginId,
      eventName,
      listenerId,
      handler,
      options: { ...options, id: listenerId },
      active,
    };
    if (active) {
      stored.unsubscribe = this.eventBus.subscribe(eventName, handler, stored.options);
    }
    this.listeners.push(stored);
  }

  activatePlugin(pluginId: string): void {
    for (const g of this.graphql) {
      if (g.pluginId === pluginId) {
        g.active = true;
      }
    }
    for (const p of this.providers) {
      if (p.pluginId === pluginId) {
        p.active = true;
      }
    }
    for (const l of this.listeners) {
      if (l.pluginId !== pluginId || l.active) {
        continue;
      }
      l.unsubscribe = this.eventBus.subscribe(l.eventName, l.handler, l.options);
      l.active = true;
    }
  }

  deactivatePlugin(pluginId: string): void {
    for (const g of this.graphql) {
      if (g.pluginId === pluginId) {
        g.active = false;
      }
    }
    for (const p of this.providers) {
      if (p.pluginId === pluginId) {
        p.active = false;
      }
    }
    for (const l of this.listeners) {
      if (l.pluginId !== pluginId || !l.active) {
        continue;
      }
      l.unsubscribe?.();
      l.unsubscribe = undefined;
      l.active = false;
    }
  }

  removePlugin(pluginId: string): void {
    this.deactivatePlugin(pluginId);
    for (let i = this.graphql.length - 1; i >= 0; i -= 1) {
      if (this.graphql[i]?.pluginId === pluginId) {
        this.graphql.splice(i, 1);
      }
    }
    for (let i = this.providers.length - 1; i >= 0; i -= 1) {
      if (this.providers[i]?.pluginId === pluginId) {
        this.providers.splice(i, 1);
      }
    }
    for (let i = this.listeners.length - 1; i >= 0; i -= 1) {
      if (this.listeners[i]?.pluginId === pluginId) {
        this.listeners.splice(i, 1);
      }
    }
  }

  listGraphQL(activeOnly = false): readonly GraphQLContribution[] {
    return activeOnly ? this.graphql.filter((g) => g.active) : [...this.graphql];
  }

  listProviders(activeOnly = false): readonly ProviderContribution[] {
    return activeOnly ? this.providers.filter((p) => p.active) : [...this.providers];
  }

  listListeners(activeOnly = false): readonly ListenerContribution[] {
    const mapped = this.listeners.map(({ pluginId, eventName, listenerId, active }) => ({
      pluginId,
      eventName,
      listenerId,
      active,
    }));
    return activeOnly ? mapped.filter((l) => l.active) : mapped;
  }

  getProvider<T = unknown>(token: string): T | undefined {
    const entry = this.providers.find((p) => p.token === token && p.active);
    return entry?.provider as T | undefined;
  }
}
