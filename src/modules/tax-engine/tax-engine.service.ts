import { BadRequestException, Injectable } from '@nestjs/common';

import { TaxProviderRegistry } from './tax-provider.registry';
import type {
  TaxCalculateInput,
  TaxCalculateResult,
  TaxProvider,
} from './tax-provider';

/**
 * Tax engine — register / get / list providers + calculate orchestration.
 * Checkout wiring uses {@link TaxEngine.calculateOrZero} (C-03).
 */
@Injectable()
export class TaxEngine {
  constructor(private readonly registry: TaxProviderRegistry) {}

  register(provider: TaxProvider, pluginId = 'core'): void {
    this.registry.register(pluginId, provider);
  }

  get(id: string): TaxProvider | undefined {
    return this.registry.get(id);
  }

  list(): readonly TaxProvider[] {
    return this.registry.list(true).map((e) => e.provider);
  }

  /** True when at least one tax provider is active. */
  hasActiveProvider(): boolean {
    return this.registry.list(true).length > 0;
  }

  /**
   * Calculate tax via a specific provider, or the sole active provider when omitted.
   */
  async calculate(
    input: TaxCalculateInput,
    providerCode?: string,
  ): Promise<TaxCalculateResult> {
    this.requireCalculateInput(input);
    const provider = this.resolveProvider(providerCode);

    let result: TaxCalculateResult;
    try {
      result = await provider.calculateTax(input);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error
          ? err.message
          : `Tax provider "${provider.code}" failed to calculate`,
      );
    }

    this.requireNonNegativeMinor(result.taxMinor, 'taxMinor');
    if (result.currencyCode !== input.currencyCode) {
      throw new BadRequestException(
        `Tax provider returned currency "${result.currencyCode}" but input was "${input.currencyCode}"`,
      );
    }
    if (result.pricingMode !== input.pricingMode) {
      throw new BadRequestException(
        `Tax provider returned pricingMode "${result.pricingMode}" but input was "${input.pricingMode}"`,
      );
    }

    return result;
  }

  /**
   * Checkout helper (C-03): when no provider is registered, tax is zero so
   * prepareCheckout / placeOrder still succeed until a plugin registers.
   */
  async calculateOrZero(
    input: TaxCalculateInput,
    providerCode?: string,
  ): Promise<TaxCalculateResult> {
    this.requireCalculateInput(input);
    if (!this.hasActiveProvider()) {
      return {
        currencyCode: input.currencyCode,
        pricingMode: input.pricingMode,
        taxMinor: '0',
        lines: [],
      };
    }
    return this.calculate(input, providerCode);
  }

  private resolveProvider(providerCode?: string): TaxProvider {
    if (providerCode?.trim()) {
      const provider = this.registry.get(providerCode.trim());
      if (!provider) {
        throw new BadRequestException(
          `Tax provider "${providerCode}" is not registered or inactive`,
        );
      }
      return provider;
    }

    const active = this.registry.list(true);
    if (active.length === 0) {
      throw new BadRequestException('No active tax provider is registered');
    }
    if (active.length > 1) {
      throw new BadRequestException(
        'Multiple tax providers are active; pass providerCode to TaxEngine.calculate',
      );
    }
    return active[0]!.provider;
  }

  private requireCalculateInput(input: TaxCalculateInput): void {
    if (!input.currencyCode?.trim()) {
      throw new BadRequestException('currencyCode is required for tax calculation');
    }
    if (input.pricingMode !== 'inclusive' && input.pricingMode !== 'exclusive') {
      throw new BadRequestException(
        'pricingMode must be "inclusive" or "exclusive"',
      );
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestException('items are required for tax calculation');
    }
  }

  private requireNonNegativeMinor(value: string, field: string): string {
    let n: bigint;
    try {
      n = BigInt(value);
    } catch {
      throw new BadRequestException(`Invalid ${field} "${value}"`);
    }
    if (n < 0n) {
      throw new BadRequestException(`${field} must be >= 0`);
    }
    return n.toString();
  }
}
