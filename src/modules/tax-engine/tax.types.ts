import { Field, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import type { TaxPricingMode } from './tax-provider';

export enum TaxPricingModeGql {
  inclusive = 'inclusive',
  exclusive = 'exclusive',
}

registerEnumType(TaxPricingModeGql, {
  name: 'TaxPricingMode',
  description: 'Whether catalog prices include tax (inclusive) or exclude it (exclusive)',
});

@ObjectType('TaxProvider', {
  description: 'Registered tax provider available for calculation',
})
export class TaxProviderType {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  displayName!: string;
}

@ObjectType('TaxClass', {
  description: 'Core-owned tax class (catalog / line tax category)',
})
export class TaxClassType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('TaxRule', {
  description: 'Core-owned jurisdiction tax rule bound to a tax class',
})
export class TaxRuleType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  taxClassId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, {
    description: 'ISO 3166-1 alpha-2 country code',
  })
  countryCode!: string;

  @Field(() => String, { nullable: true })
  province!: string | null;

  @Field(() => String, { nullable: true })
  postalCode!: string | null;

  @Field(() => Int, {
    description: 'Tax rate in basis points (1000 = 10.00%)',
  })
  rateBps!: number;

  @Field(() => Int)
  priority!: number;

  @Field(() => Boolean)
  appliesToShipping!: boolean;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType({ description: 'Create a tax class' })
export class CreateTaxClassInput {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  isActive?: boolean;
}

@InputType({ description: 'Update a tax class' })
export class UpdateTaxClassInput {
  @Field(() => String, { nullable: true })
  code?: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}

@InputType({ description: 'Create a tax rule' })
export class CreateTaxRuleInput {
  @Field(() => ID)
  taxClassId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  countryCode!: string;

  @Field(() => String, { nullable: true })
  province?: string;

  @Field(() => String, { nullable: true })
  postalCode?: string;

  @Field(() => Int)
  rateBps!: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  priority?: number;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  appliesToShipping?: boolean;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  isActive?: boolean;
}

@InputType({ description: 'Update a tax rule' })
export class UpdateTaxRuleInput {
  @Field(() => ID, { nullable: true })
  taxClassId?: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  countryCode?: string;

  @Field(() => String, { nullable: true })
  province?: string;

  @Field(() => String, { nullable: true })
  postalCode?: string;

  @Field(() => Int, { nullable: true })
  rateBps?: number;

  @Field(() => Int, { nullable: true })
  priority?: number;

  @Field(() => Boolean, { nullable: true })
  appliesToShipping?: boolean;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}

@InputType({ description: 'Address fragment for tax calculation' })
export class TaxAddressInput {
  @Field(() => String)
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

@InputType({ description: 'Line item for admin tax calculation preview' })
export class TaxCalculateLineItemInput {
  @Field(() => String, { nullable: true })
  sku?: string;

  @Field(() => String, { nullable: true })
  productId?: string;

  @Field(() => String, { nullable: true })
  variantId?: string;

  @Field(() => String, { nullable: true })
  taxClassCode?: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => String, {
    description: 'Unit price in minor units (decimal string)',
  })
  unitAmountMinor!: string;
}

@InputType({
  description: 'Input for TaxEngine.calculate (admin preview)',
})
export class CalculateTaxInput {
  @Field(() => String)
  currencyCode!: string;

  @Field(() => TaxPricingModeGql)
  pricingMode!: TaxPricingMode;

  @Field(() => TaxAddressInput, { nullable: true })
  address?: TaxAddressInput;

  @Field(() => [TaxCalculateLineItemInput])
  items!: TaxCalculateLineItemInput[];

  @Field(() => String, { nullable: true })
  shippingMinor?: string;

  @Field(() => String, { nullable: true })
  subtotalMinor?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Provider code when multiple tax providers are active',
  })
  providerCode?: string;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded opaque metadata forwarded to the provider',
  })
  metadataJson?: string;
}

@ObjectType('TaxLineResult', {
  description: 'Per-line or order-level tax breakdown',
})
export class TaxLineResultType {
  @Field(() => Int, { nullable: true })
  lineIndex!: number | null;

  @Field(() => String, { nullable: true })
  taxClassCode!: string | null;

  @Field(() => Int, { nullable: true })
  rateBps!: number | null;

  @Field(() => String)
  taxAmountMinor!: string;

  @Field(() => String)
  taxableAmountMinor!: string;

  @Field(() => String, { nullable: true })
  name!: string | null;
}

@ObjectType('TaxCalculateResult', {
  description: 'Aggregated tax calculation from TaxEngine',
})
export class TaxCalculateResultType {
  @Field(() => String)
  currencyCode!: string;

  @Field(() => TaxPricingModeGql)
  pricingMode!: TaxPricingMode;

  @Field(() => String)
  taxMinor!: string;

  @Field(() => String, { nullable: true })
  netMinor!: string | null;

  @Field(() => String, { nullable: true })
  grossMinor!: string | null;

  @Field(() => [TaxLineResultType])
  lines!: TaxLineResultType[];

  @Field(() => String, { nullable: true })
  metadataJson!: string | null;
}
