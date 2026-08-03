import { BadRequestException, Injectable } from '@nestjs/common';

import { ShippingMethodRegistry } from './shipping-method.registry';
import type {
  QuotedShippingRate,
  ShippingMethodProvider,
  ShippingQuoteInput,
  ShippingQuoteResult,
} from './shipping-method';

/**
 * Shipping engine — register / get / list methods + quote orchestration (B-02).
 * Persisting a selected rate onto cart/order is done by the order module via
 * {@link findQuotedRate} validation helpers.
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

  /**
   * Collect rate quotes from every active shipping method.
   * Provider failures are skipped so one broken carrier does not block checkout.
   */
  async quote(input: ShippingQuoteInput): Promise<ShippingQuoteResult> {
    this.requireQuoteInput(input);
    const rates: QuotedShippingRate[] = [];

    for (const entry of this.registry.list(true)) {
      const method = entry.method;
      let quoted: Awaited<ReturnType<ShippingMethodProvider['quoteRates']>>;
      try {
        quoted = await method.quoteRates(input);
      } catch {
        continue;
      }
      for (const rate of quoted) {
        rates.push({
          ...rate,
          methodCode: method.code,
          methodDisplayName: method.displayName,
        });
      }
    }

    return { currencyCode: input.currencyCode, rates };
  }

  /**
   * Re-quote and resolve a specific method + rate code.
   * Throws when the selection is missing or amounts are invalid.
   */
  async findQuotedRate(
    input: ShippingQuoteInput,
    methodCode: string,
    rateCode: string,
  ): Promise<QuotedShippingRate> {
    const method = methodCode.trim();
    const rate = rateCode.trim();
    if (!method || !rate) {
      throw new BadRequestException(
        'shipping methodCode and rateCode are required',
      );
    }

    const provider = this.registry.get(method);
    if (!provider) {
      throw new BadRequestException(
        `Shipping method "${method}" is not registered or inactive`,
      );
    }

    this.requireQuoteInput(input);

    let quoted: Awaited<ReturnType<ShippingMethodProvider['quoteRates']>>;
    try {
      quoted = await provider.quoteRates(input);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error
          ? err.message
          : `Shipping method "${method}" failed to quote`,
      );
    }

    const match = quoted.find((r) => r.code === rate);
    if (!match) {
      throw new BadRequestException(
        `Shipping rate "${rate}" is not available from method "${method}"`,
      );
    }

    this.requireNonNegativeMinor(match.amount.amountMinor);

    return {
      ...match,
      methodCode: provider.code,
      methodDisplayName: provider.displayName,
    };
  }

  private requireQuoteInput(input: ShippingQuoteInput): void {
    if (!input.currencyCode?.trim()) {
      throw new BadRequestException('currencyCode is required for shipping quote');
    }
    if (!input.destination?.countryCode?.trim()) {
      throw new BadRequestException(
        'destination.countryCode is required for shipping quote',
      );
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestException(
        'items are required for shipping quote',
      );
    }
  }

  private requireNonNegativeMinor(value: string): string {
    let n: bigint;
    try {
      n = BigInt(value);
    } catch {
      throw new BadRequestException(
        `Invalid shipping amountMinor "${value}"`,
      );
    }
    if (n < 0n) {
      throw new BadRequestException('shipping amountMinor must be >= 0');
    }
    return n.toString();
  }
}
