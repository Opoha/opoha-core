import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import type { QuotedShippingRate, ShippingQuoteResult } from './shipping-method';
import { ShippingEngine } from './shipping-engine.service';
import {
  QuoteShippingRatesInput,
  ShippingMethodType,
  ShippingQuoteType,
  ShippingRateType,
} from './shipping.types';

function toRateType(rate: QuotedShippingRate): ShippingRateType {
  return {
    methodCode: rate.methodCode,
    methodDisplayName: rate.methodDisplayName,
    code: rate.code,
    displayName: rate.displayName,
    amount: {
      amountMinor: rate.amount.amountMinor,
      currencyCode: rate.amount.currencyCode,
    },
    minTransitDays: rate.minTransitDays ?? null,
    maxTransitDays: rate.maxTransitDays ?? null,
    metadataJson: rate.metadata ? JSON.stringify(rate.metadata) : null,
  };
}

function toQuoteType(result: ShippingQuoteResult): ShippingQuoteType {
  return {
    currencyCode: result.currencyCode,
    rates: result.rates.map(toRateType),
  };
}

function parseMetadataJson(
  metadataJson: string | undefined,
): Record<string, unknown> | undefined {
  if (!metadataJson) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(metadataJson);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('metadataJson must encode a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new BadRequestException('metadataJson must be a valid JSON object string');
  }
}

@Resolver(() => ShippingMethodType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class ShippingResolver {
  constructor(private readonly shipping: ShippingEngine) {}

  @Query(() => [ShippingMethodType], {
    name: 'shippingMethods',
    description: 'List active registered shipping methods',
  })
  @RequirePermission('shipping:read')
  shippingMethods(): ShippingMethodType[] {
    return this.shipping.list().map((method) => ({
      code: method.code,
      displayName: method.displayName,
    }));
  }

  @Query(() => ShippingQuoteType, {
    name: 'quoteShippingRates',
    description:
      'Quote shipping rates from all active methods (flat-rate, carriers, …)',
  })
  @RequirePermission('shipping:read')
  async quoteShippingRates(
    @Args('input') input: QuoteShippingRatesInput,
  ): Promise<ShippingQuoteType> {
    const result = await this.shipping.quote({
      currencyCode: input.currencyCode,
      destination: {
        countryCode: input.destination.countryCode,
        postalCode: input.destination.postalCode,
        province: input.destination.province,
        city: input.destination.city,
        line1: input.destination.line1,
        line2: input.destination.line2,
      },
      origin: input.origin
        ? {
            countryCode: input.origin.countryCode,
            postalCode: input.origin.postalCode,
            province: input.origin.province,
            city: input.origin.city,
            line1: input.origin.line1,
            line2: input.origin.line2,
          }
        : undefined,
      items: input.items.map((item) => ({
        sku: item.sku,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitAmountMinor: item.unitAmountMinor,
        weightGrams: item.weightGrams,
      })),
      subtotalMinor: input.subtotalMinor,
      metadata: parseMetadataJson(input.metadataJson),
    });
    return toQuoteType(result);
  }
}
