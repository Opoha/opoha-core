import { Injectable } from '@nestjs/common';

import { PaymentProviderRegistry } from './payment-provider.registry';
import type { PaymentProvider } from './payment-provider';

/**
 * Payment engine stub — register / get / list providers by code.
 * No authorize/capture/refund orchestration until Phase 1–2.
 */
@Injectable()
export class PaymentEngine {
  constructor(private readonly registry: PaymentProviderRegistry) {}

  /** Register a provider (pluginId defaults to `core` for in-process stubs). */
  register(provider: PaymentProvider, pluginId = 'core'): void {
    this.registry.register(pluginId, provider);
  }

  get(id: string): PaymentProvider | undefined {
    return this.registry.get(id);
  }

  list(): readonly PaymentProvider[] {
    return this.registry.list(true).map((e) => e.provider);
  }
}
