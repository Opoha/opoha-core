import { Injectable } from '@nestjs/common';

import { ShippingMethodRegistry } from './shipping-method.registry';
import type { ShippingMethodProvider } from './shipping-method';

/**
 * Shipping engine stub — register / get / list methods by code.
 * No rate quotes until Phase 1–2.
 */
@Injectable()
export class ShippingEngine {
  constructor(private readonly registry: ShippingMethodRegistry) {}

  register(provider: ShippingMethodProvider, pluginId = 'core'): void {
    this.registry.register(pluginId, provider);
  }

  get(id: string): ShippingMethodProvider | undefined {
    return this.registry.get(id);
  }

  list(): readonly ShippingMethodProvider[] {
    return this.registry.list(true).map((e) => e.method);
  }
}
