import { Injectable } from '@nestjs/common';

import type {
  RegisteredShippingMethod,
  ShippingMethodProvider,
} from './shipping-method';

/**
 * Registry for shipping methods (D-08 / AC-MVP-027 / Phase 2 B-01+B-02).
 * Providers expose quoteRates; ShippingEngine.quote orchestrates across methods.
 */
@Injectable()
export class ShippingMethodRegistry {
  private readonly entries: RegisteredShippingMethod[] = [];

  register(
    pluginId: string,
    method: ShippingMethodProvider,
    active = true,
  ): void {
    if (!method.code || method.code.trim().length === 0) {
      throw new Error('Shipping method code is required');
    }
    const existing = this.entries.find((e) => e.method.code === method.code);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `Shipping method conflict: code "${method.code}" already registered by plugin "${existing.pluginId}"`,
      );
    }
    if (existing) {
      existing.method = method;
      existing.active = active;
      return;
    }
    this.entries.push({ pluginId, method, active });
  }

  get(id: string): ShippingMethodProvider | undefined {
    return this.entries.find((e) => e.method.code === id && e.active)?.method;
  }

  list(activeOnly = false): readonly RegisteredShippingMethod[] {
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
