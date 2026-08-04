import { Injectable } from '@nestjs/common';

import type { PaymentProvider, RegisteredPaymentProvider } from './payment-provider';

/**
 * Registry for payment providers (MVP D-08 / Phase 2 A-01).
 * Plugins register; PaymentEngine orchestrates authorize/capture/refund.
 */
@Injectable()
export class PaymentProviderRegistry {
  private readonly entries: RegisteredPaymentProvider[] = [];

  register(pluginId: string, provider: PaymentProvider, active = true): void {
    if (!provider.code || provider.code.trim().length === 0) {
      throw new Error('Payment provider code is required');
    }
    const existing = this.entries.find((e) => e.provider.code === provider.code);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `Payment provider conflict: code "${provider.code}" already registered by plugin "${existing.pluginId}"`,
      );
    }
    if (existing) {
      existing.provider = provider;
      existing.active = active;
      return;
    }
    this.entries.push({ pluginId, provider, active });
  }

  get(id: string): PaymentProvider | undefined {
    return this.entries.find((e) => e.provider.code === id && e.active)?.provider;
  }

  list(activeOnly = false): readonly RegisteredPaymentProvider[] {
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
