import { BadRequestException, Injectable } from '@nestjs/common';

import { PromotionRuleRegistry } from './promotion-rule.registry';
import type {
  PromotionApplication,
  PromotionApplyInput,
  PromotionApplyResult,
  PromotionRuleProvider,
} from './promotion-rule';

/**
 * Promotions rules engine — register / get / list providers + aggregate apply.
 * Checkout wiring uses {@link PromotionsEngine.applyOrZero} (D-01).
 */
@Injectable()
export class PromotionsEngine {
  constructor(private readonly registry: PromotionRuleRegistry) {}

  register(provider: PromotionRuleProvider, pluginId = 'core'): void {
    this.registry.register(pluginId, provider);
  }

  get(id: string): PromotionRuleProvider | undefined {
    return this.registry.get(id);
  }

  list(): readonly PromotionRuleProvider[] {
    return this.registry.list(true).map((e) => e.provider);
  }

  /** True when at least one promotion rule provider is active. */
  hasActiveProvider(): boolean {
    return this.registry.list(true).length > 0;
  }

  /**
   * Apply promotions via all active providers (or a single code when passed).
   * Discounts are summed and capped at merchandise subtotal.
   */
  async apply(input: PromotionApplyInput, providerCode?: string): Promise<PromotionApplyResult> {
    this.requireApplyInput(input);
    const providers = this.resolveProviders(providerCode);

    const applications: PromotionApplication[] = [];
    let discount = 0n;
    let freeShipping = false;

    for (const provider of providers) {
      let result: PromotionApplyResult;
      try {
        result = await provider.apply(input);
      } catch (err) {
        throw new BadRequestException(
          err instanceof Error
            ? err.message
            : `Promotion provider "${provider.code}" failed to apply`,
        );
      }

      if (result.currencyCode !== input.currencyCode) {
        throw new BadRequestException(
          `Promotion provider returned currency "${result.currencyCode}" but input was "${input.currencyCode}"`,
        );
      }

      const providerDiscount = this.requireNonNegativeMinor(result.discountMinor, 'discountMinor');
      discount += BigInt(providerDiscount);
      if (result.freeShipping) {
        freeShipping = true;
      }
      for (const app of result.applications ?? []) {
        this.requireNonNegativeMinor(app.discountMinor, 'application.discountMinor');
        if (app.freeShipping) {
          freeShipping = true;
        }
        applications.push(app);
      }
    }

    const subtotal = BigInt(String(input.subtotalMinor ?? '0'));
    const capped = discount > subtotal ? subtotal : discount;

    return {
      currencyCode: input.currencyCode,
      discountMinor: capped.toString(),
      applications,
      freeShipping,
    };
  }

  /**
   * Checkout helper (D-01 / D-03): when no provider is registered, discount is
   * zero so prepareCheckout / placeOrder still succeed. With the core TypeORM
   * provider registered on boot, coupon + automatic discounts apply from
   * Coupon / DiscountRule entities; plugins may register additional providers.
   */
  async applyOrZero(
    input: PromotionApplyInput,
    providerCode?: string,
  ): Promise<PromotionApplyResult> {
    this.requireApplyInput(input);
    if (!this.hasActiveProvider()) {
      return {
        currencyCode: input.currencyCode,
        discountMinor: '0',
        applications: [],
        freeShipping: false,
      };
    }
    return this.apply(input, providerCode);
  }

  private resolveProviders(providerCode?: string): PromotionRuleProvider[] {
    if (providerCode?.trim()) {
      const provider = this.registry.get(providerCode.trim());
      if (!provider) {
        throw new BadRequestException(
          `Promotion rule provider "${providerCode}" is not registered or inactive`,
        );
      }
      return [provider];
    }

    const active = this.registry.list(true);
    if (active.length === 0) {
      throw new BadRequestException('No active promotion rule provider is registered');
    }
    return active.map((e) => e.provider);
  }

  private requireApplyInput(input: PromotionApplyInput): void {
    if (!input.currencyCode?.trim()) {
      throw new BadRequestException('currencyCode is required for promotion apply');
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestException('items are required for promotion apply');
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
