import { Injectable } from '@nestjs/common';

import type { RegisteredSearchProvider, SearchProvider } from './search-provider';

/**
 * Registry for search providers (Phase 4 A-01 / A-02).
 * Plugins register; SearchEngine orchestrates index / delete / search.
 */
@Injectable()
export class SearchProviderRegistry {
  private readonly entries: RegisteredSearchProvider[] = [];

  register(pluginId: string, provider: SearchProvider, active = true): void {
    if (!provider.code || provider.code.trim().length === 0) {
      throw new Error('Search provider code is required');
    }
    const existing = this.entries.find((e) => e.provider.code === provider.code);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `Search provider conflict: code "${provider.code}" already registered by plugin "${existing.pluginId}"`,
      );
    }
    if (existing) {
      existing.provider = provider;
      existing.active = active;
      return;
    }
    this.entries.push({ pluginId, provider, active });
  }

  get(id: string): SearchProvider | undefined {
    return this.entries.find((e) => e.provider.code === id && e.active)?.provider;
  }

  list(activeOnly = false): readonly RegisteredSearchProvider[] {
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
