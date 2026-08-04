import { Injectable } from '@nestjs/common';

import type { RegisteredScheduledJob, ScheduledJobHandler } from './scheduled-job';

/**
 * Registry for scheduled job handlers.
 * Plugins register; JobsService persists definitions and bridges the queue.
 */
@Injectable()
export class ScheduledJobRegistry {
  private readonly entries: RegisteredScheduledJob[] = [];

  register(
    pluginId: string | null,
    input: {
      code: string;
      displayName: string;
      cron: string;
      timezone: string;
      handlerKey: string;
      handler: ScheduledJobHandler;
    },
    active = true,
  ): RegisteredScheduledJob {
    if (!input.code || input.code.trim().length === 0) {
      throw new Error('Scheduled job code is required');
    }
    const existing = this.entries.find((e) => e.code === input.code);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `Scheduled job conflict: code "${input.code}" already registered` +
          (existing.pluginId ? ` by plugin "${existing.pluginId}"` : ' by core'),
      );
    }
    if (existing) {
      existing.displayName = input.displayName;
      existing.cron = input.cron;
      existing.timezone = input.timezone;
      existing.handlerKey = input.handlerKey;
      existing.handler = input.handler;
      existing.active = active;
      return existing;
    }
    const entry: RegisteredScheduledJob = {
      pluginId,
      code: input.code,
      displayName: input.displayName,
      cron: input.cron,
      timezone: input.timezone,
      handlerKey: input.handlerKey,
      handler: input.handler,
      active,
    };
    this.entries.push(entry);
    return entry;
  }

  get(code: string): RegisteredScheduledJob | undefined {
    return this.entries.find((e) => e.code === code && e.active);
  }

  list(activeOnly = false): readonly RegisteredScheduledJob[] {
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

  removePlugin(pluginId: string): RegisteredScheduledJob[] {
    const removed: RegisteredScheduledJob[] = [];
    for (let i = this.entries.length - 1; i >= 0; i -= 1) {
      const entry = this.entries[i];
      if (entry?.pluginId === pluginId) {
        removed.push(entry);
        this.entries.splice(i, 1);
      }
    }
    return removed;
  }
}
