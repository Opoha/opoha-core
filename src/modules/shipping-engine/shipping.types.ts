import {
  Field,
  InputType,
  Int,
  ObjectType,
} from '@nestjs/graphql';

@ObjectType('ShippingMethod', {
  description: 'Registered shipping method available for rate quotes',
})
export class ShippingMethodType {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  displayName!: string;
}

@ObjectType('ShippingMoneyAmount', {
  description: 'Minor-unit money amount (bigint as decimal string)',
})
export class ShippingMoneyAmountType {
  @Field(() => String)
  amountMinor!: string;

  @Field(() => String)
  currencyCode!: string;
}

@ObjectType('ShippingRate', {
  description: 'Quoted shipping rate from a registered method',
})
export class ShippingRateType {
  @Field(() => String, {
    description: 'ShippingMethodProvider.code that produced this rate',
  })
  methodCode!: string;

  @Field(() => String)
  methodDisplayName!: string;

  @Field(() => String, {
    description: 'Provider-specific rate / service-level code',
  })
  code!: string;

  @Field(() => String)
  displayName!: string;

  @Field(() => ShippingMoneyAmountType)
  amount!: ShippingMoneyAmountType;

  @Field(() => Int, { nullable: true })
  minTransitDays!: number | null;

  @Field(() => Int, { nullable: true })
  maxTransitDays!: number | null;

  /** JSON-encoded opaque metadata (no secrets). */
  @Field(() => String, { nullable: true })
  metadataJson!: string | null;
}

@ObjectType('ShippingQuote', {
  description: 'Aggregated rate quotes from active shipping methods',
})
export class ShippingQuoteType {
  @Field(() => String)
  currencyCode!: string;

  @Field(() => [ShippingRateType])
  rates!: ShippingRateType[];
}

@InputType({ description: 'Destination / origin address fragment for quotes' })
export class ShippingAddressInput {
  @Field(() => String, {
    description: 'ISO 3166-1 alpha-2 country code',
  })
  countryCode!: string;

  @Field(() => String, { nullable: true })
  postalCode?: string;

  @Field(() => String, { nullable: true })
  province?: string;

  @Field(() => String, { nullable: true })
  city?: string;

  @Field(() => String, { nullable: true })
  line1?: string;

  @Field(() => String, { nullable: true })
  line2?: string;
}

@InputType({ description: 'Line item used for shipping rate quotes' })
export class ShippingQuoteLineItemInput {
  @Field(() => String, { nullable: true })
  sku?: string;

  @Field(() => String, { nullable: true })
  productId?: string;

  @Field(() => String, { nullable: true })
  variantId?: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => String, {
    description: 'Unit price in minor units (decimal string)',
  })
  unitAmountMinor!: string;

  @Field(() => Int, { nullable: true })
  weightGrams?: number;
}

@InputType({
  description: 'Input for ShippingEngine.quote across active methods',
})
export class QuoteShippingRatesInput {
  @Field(() => String)
  currencyCode!: string;

  @Field(() => ShippingAddressInput)
  destination!: ShippingAddressInput;

  @Field(() => ShippingAddressInput, { nullable: true })
  origin?: ShippingAddressInput;

  @Field(() => [ShippingQuoteLineItemInput])
  items!: ShippingQuoteLineItemInput[];

  @Field(() => String, {
    nullable: true,
    description: 'Cart/order subtotal in minor units (decimal string)',
  })
  subtotalMinor?: string;

  /** JSON-encoded metadata forwarded to providers. */
  @Field(() => String, { nullable: true })
  metadataJson?: string;
}
