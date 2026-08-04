import { Field, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import type { CouponKind } from './entities/coupon.entity';
import type { DiscountRuleKind } from './entities/discount-rule.entity';

export enum CouponKindGql {
  percentage = 'percentage',
  fixed_amount = 'fixed_amount',
  free_shipping = 'free_shipping',
}

registerEnumType(CouponKindGql, {
  name: 'CouponKind',
  description: 'Coupon discount kind',
});

export enum DiscountRuleKindGql {
  percentage = 'percentage',
  fixed_amount = 'fixed_amount',
  free_shipping = 'free_shipping',
  bxgy = 'bxgy',
  automatic = 'automatic',
}

registerEnumType(DiscountRuleKindGql, {
  name: 'DiscountRuleKind',
  description: 'Automatic discount rule kind',
});

@ObjectType('PromotionProvider', {
  description: 'Registered promotion rule provider available for apply',
})
export class PromotionProviderType {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  displayName!: string;
}

@ObjectType('Coupon', {
  description: 'Core-owned merchant coupon code',
})
export class CouponType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => CouponKindGql)
  kind!: CouponKind;

  @Field(() => Int, { nullable: true })
  valueBps!: number | null;

  @Field(() => String, { nullable: true })
  amountMinor!: string | null;

  @Field(() => String, { nullable: true })
  currencyCode!: string | null;

  @Field(() => String, { nullable: true })
  minSubtotalMinor!: string | null;

  @Field(() => Int, { nullable: true })
  maxUses!: number | null;

  @Field(() => Int, { nullable: true })
  maxUsesPerCustomer!: number | null;

  @Field(() => Int)
  usageCount!: number;

  @Field(() => Int)
  priority!: number;

  @Field(() => Date, { nullable: true })
  startsAt!: Date | null;

  @Field(() => Date, { nullable: true })
  endsAt!: Date | null;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => String, { nullable: true })
  metadataJson!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('DiscountRule', {
  description: 'Core-owned automatic discount rule',
})
export class DiscountRuleType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => DiscountRuleKindGql)
  kind!: DiscountRuleKind;

  @Field(() => Int, { nullable: true })
  valueBps!: number | null;

  @Field(() => String, { nullable: true })
  amountMinor!: string | null;

  @Field(() => String, { nullable: true })
  currencyCode!: string | null;

  @Field(() => String, { nullable: true })
  minSubtotalMinor!: string | null;

  @Field(() => Int)
  priority!: number;

  @Field(() => Boolean)
  stackable!: boolean;

  @Field(() => Date, { nullable: true })
  startsAt!: Date | null;

  @Field(() => Date, { nullable: true })
  endsAt!: Date | null;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => String, { nullable: true })
  conditionsJson!: string | null;

  @Field(() => String, { nullable: true })
  metadataJson!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType({ description: 'Create a coupon code' })
export class CreateCouponInput {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => CouponKindGql)
  kind!: CouponKind;

  @Field(() => Int, { nullable: true })
  valueBps?: number;

  @Field(() => String, { nullable: true })
  amountMinor?: string;

  @Field(() => String, { nullable: true })
  currencyCode?: string;

  @Field(() => String, { nullable: true })
  minSubtotalMinor?: string;

  @Field(() => Int, { nullable: true })
  maxUses?: number;

  @Field(() => Int, { nullable: true })
  maxUsesPerCustomer?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  priority?: number;

  @Field(() => Date, { nullable: true })
  startsAt?: Date;

  @Field(() => Date, { nullable: true })
  endsAt?: Date;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  isActive?: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded opaque metadata (E-03: segmentIds / segmentCodes)',
  })
  metadataJson?: string;
}

@InputType({ description: 'Update a coupon code' })
export class UpdateCouponInput {
  @Field(() => String, { nullable: true })
  code?: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => CouponKindGql, { nullable: true })
  kind?: CouponKind;

  @Field(() => Int, { nullable: true })
  valueBps?: number;

  @Field(() => String, { nullable: true })
  amountMinor?: string;

  @Field(() => String, { nullable: true })
  currencyCode?: string;

  @Field(() => String, { nullable: true })
  minSubtotalMinor?: string;

  @Field(() => Int, { nullable: true })
  maxUses?: number;

  @Field(() => Int, { nullable: true })
  maxUsesPerCustomer?: number;

  @Field(() => Int, { nullable: true })
  priority?: number;

  @Field(() => Date, { nullable: true })
  startsAt?: Date;

  @Field(() => Date, { nullable: true })
  endsAt?: Date;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded opaque metadata (E-03: segmentIds / segmentCodes)',
  })
  metadataJson?: string;
}

@InputType({ description: 'Create an automatic discount rule' })
export class CreateDiscountRuleInput {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => DiscountRuleKindGql)
  kind!: DiscountRuleKind;

  @Field(() => Int, { nullable: true })
  valueBps?: number;

  @Field(() => String, { nullable: true })
  amountMinor?: string;

  @Field(() => String, { nullable: true })
  currencyCode?: string;

  @Field(() => String, { nullable: true })
  minSubtotalMinor?: string;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  priority?: number;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  stackable?: boolean;

  @Field(() => Date, { nullable: true })
  startsAt?: Date;

  @Field(() => Date, { nullable: true })
  endsAt?: Date;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  isActive?: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded rule conditions (BXGY; E-03: segmentIds / segmentCodes)',
  })
  conditionsJson?: string;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded opaque metadata (E-03: segmentIds / segmentCodes)',
  })
  metadataJson?: string;
}

@InputType({ description: 'Update an automatic discount rule' })
export class UpdateDiscountRuleInput {
  @Field(() => String, { nullable: true })
  code?: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => DiscountRuleKindGql, { nullable: true })
  kind?: DiscountRuleKind;

  @Field(() => Int, { nullable: true })
  valueBps?: number;

  @Field(() => String, { nullable: true })
  amountMinor?: string;

  @Field(() => String, { nullable: true })
  currencyCode?: string;

  @Field(() => String, { nullable: true })
  minSubtotalMinor?: string;

  @Field(() => Int, { nullable: true })
  priority?: number;

  @Field(() => Boolean, { nullable: true })
  stackable?: boolean;

  @Field(() => Date, { nullable: true })
  startsAt?: Date;

  @Field(() => Date, { nullable: true })
  endsAt?: Date;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded rule conditions (BXGY; E-03: segmentIds / segmentCodes)',
  })
  conditionsJson?: string;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded opaque metadata (E-03: segmentIds / segmentCodes)',
  })
  metadataJson?: string;
}

@InputType({ description: 'Line item for admin promotion apply preview' })
export class PromotionApplyLineItemInput {
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
}

@InputType({
  description: 'Input for PromotionsEngine.applyOrZero (admin preview)',
})
export class ApplyPromotionsInput {
  @Field(() => String)
  currencyCode!: string;

  @Field(() => [PromotionApplyLineItemInput])
  items!: PromotionApplyLineItemInput[];

  @Field(() => String, { nullable: true })
  subtotalMinor?: string;

  @Field(() => String, { nullable: true })
  shippingMinor?: string;

  @Field(() => String, { nullable: true })
  couponCode?: string;

  @Field(() => String, { nullable: true })
  customerId?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Provider code when multiple promotion providers are active',
  })
  providerCode?: string;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded opaque metadata forwarded to the provider',
  })
  metadataJson?: string;
}

@ObjectType('PromotionApplication', {
  description: 'One applied promotion / discount line',
})
export class PromotionApplicationType {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  kind!: string;

  @Field(() => String)
  discountMinor!: string;

  @Field(() => Boolean, { nullable: true })
  freeShipping!: boolean | null;

  @Field(() => String, { nullable: true })
  label!: string | null;

  @Field(() => Int, { nullable: true })
  lineIndex!: number | null;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded opaque metadata',
  })
  metadataJson!: string | null;
}

@ObjectType('PromotionApplyResult', {
  description: 'Aggregated promotion apply result from PromotionsEngine',
})
export class PromotionApplyResultType {
  @Field(() => String)
  currencyCode!: string;

  @Field(() => String)
  discountMinor!: string;

  @Field(() => [PromotionApplicationType])
  applications!: PromotionApplicationType[];

  @Field(() => Boolean, { nullable: true })
  freeShipping!: boolean | null;

  @Field(() => String, {
    nullable: true,
    description: 'JSON-encoded opaque metadata',
  })
  metadataJson!: string | null;
}
