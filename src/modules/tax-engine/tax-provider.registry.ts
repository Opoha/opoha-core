import { Injectable } from '@nestjs/common';

import type { RegisteredTaxProvider, TaxProvider } from './tax-provider';

/**
 * Registry for tax providers.
 * Plugins register; TaxEngine orchestrates calculateTax.
 */
@Injectable()
export class TaxProviderRegistry {
  private readonly entries: RegisteredTaxProvider[] = [];

  register(pluginId: string, provider: TaxProvider, active = true): void {
    if (!provider.code || provider.code.trim().length === 0) {
      throw new Error('Tax provider code is required');
    }
    const existing = this.entries.find((e) => e.provider.code === provider.code);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `Tax provider conflict: code "${provider.code}" already registered by plugin "${existing.pluginId}"`,
      );
    }
    if (existing) {
      existing.provider = provider;
      existing.active = active;
      return;
    }
    this.entries.push({ pluginId, provider, active });
  }

  get(id: string): TaxProvider | undefined {
    return this.entries.find((e) => e.provider.code === id && e.active)?.provider;
  }

  list(activeOnly = false): readonly RegisteredTaxProvider[] {
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
