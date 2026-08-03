import { Injectable } from '@nestjs/common';

import type {
  RegisteredStorageAdapter,
  StorageAdapter,
} from './storage-adapter';

/**
 * In-memory registry for storage adapters registered by plugins (D-09).
 */
@Injectable()
export class StorageAdapterRegistry {
  private readonly entries: RegisteredStorageAdapter[] = [];

  register(
    pluginId: string,
    adapter: StorageAdapter,
    active = true,
  ): void {
    if (!adapter.code || adapter.code.trim().length === 0) {
      throw new Error('Storage adapter code is required');
    }
    const existing = this.entries.find((e) => e.adapter.code === adapter.code);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `Storage adapter conflict: code "${adapter.code}" already registered by plugin "${existing.pluginId}"`,
      );
    }
    if (existing) {
      existing.adapter = adapter;
      existing.active = active;
      return;
    }
    this.entries.push({ pluginId, adapter, active });
  }

  get(id: string): StorageAdapter | undefined {
    return this.entries.find((e) => e.adapter.code === id && e.active)?.adapter;
  }

  list(activeOnly = false): readonly RegisteredStorageAdapter[] {
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
