import { Injectable } from '@nestjs/common';

import type { AnalyticsSink, RegisteredAnalyticsSink } from './analytics-sink';

/**
 * Registry for analytics sinks.
 * Plugins / storefront adapters register a sink; AnalyticsSinkDispatcher
 * forwards cataloged analytics events (ANALYTICS_EVENT_NAMES) to active sinks.
 * Mirrors SearchProviderRegistry — core never imports the sink implementation.
 */
@Injectable()
export class AnalyticsSinkRegistry {
  private readonly entries: RegisteredAnalyticsSink[] = [];

  register(pluginId: string, sink: AnalyticsSink, active = true): void {
    if (!sink.code || sink.code.trim().length === 0) {
      throw new Error('Analytics sink code is required');
    }
    const existing = this.entries.find((e) => e.sink.code === sink.code);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `Analytics sink conflict: code "${sink.code}" already registered by plugin "${existing.pluginId}"`,
      );
    }
    if (existing) {
      existing.sink = sink;
      existing.active = active;
      return;
    }
    this.entries.push({ pluginId, sink, active });
  }

  get(code: string): AnalyticsSink | undefined {
    return this.entries.find((e) => e.sink.code === code && e.active)?.sink;
  }

  list(activeOnly = false): readonly RegisteredAnalyticsSink[] {
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

  removePlugin(pluginId: string): void {
    for (let i = this.entries.length - 1; i >= 0; i -= 1) {
      if (this.entries[i]?.pluginId === pluginId) {
        this.entries.splice(i, 1);
      }
    }
  }
}
