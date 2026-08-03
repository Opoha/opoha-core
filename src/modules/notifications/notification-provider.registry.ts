import { Injectable } from '@nestjs/common';

import type {
  NotificationProvider,
  RegisteredNotificationProvider,
} from './notification-provider';

/**
 * Registry for notification providers (Phase 2 E-01).
 * Plugins register; NotificationsService orchestrates send.
 */
@Injectable()
export class NotificationProviderRegistry {
  private readonly entries: RegisteredNotificationProvider[] = [];

  register(
    pluginId: string,
    provider: NotificationProvider,
    active = true,
  ): void {
    if (!provider.code || provider.code.trim().length === 0) {
      throw new Error('Notification provider code is required');
    }
    const existing = this.entries.find(
      (e) => e.provider.code === provider.code,
    );
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `Notification provider conflict: code "${provider.code}" already registered by plugin "${existing.pluginId}"`,
      );
    }
    if (existing) {
      existing.provider = provider;
      existing.active = active;
      return;
    }
    this.entries.push({ pluginId, provider, active });
  }

  get(id: string): NotificationProvider | undefined {
    return this.entries.find((e) => e.provider.code === id && e.active)
      ?.provider;
  }

  list(activeOnly = false): readonly RegisteredNotificationProvider[] {
    return activeOnly
      ? this.entries.filter((e) => e.active)
      : [...this.entries];
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
