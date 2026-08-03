import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Line item in a shopping cart' })
export class CartLineType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  cartId!: string;

  @Field(() => ID)
  variantId!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => String, {
    description: 'Unit price snapshot in minor units',
  })
  unitPriceMinor!: string;

  @Field(() => ID, { nullable: true })
  reservationId!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType({ description: 'Shopping cart aggregate' })
export class CartType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { nullable: true })
  customerId!: string | null;

  @Field(() => String)
  status!: string;

  @Field(() => String)
  currencyCode!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Selected shipping method provider code',
  })
  shippingMethodCode!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Selected shipping rate / service code',
  })
  shippingRateCode!: string | null;

  @Field(() => String, {
    description: 'Selected shipping amount in minor units',
  })
  shippingMinor!: string;

  @Field(() => String, {
    description:
      'Tax pricing mode: exclusive (tax added) or inclusive (tax embedded in prices)',
  })
  taxPricingMode!: string;

  @Field(() => String, {
    nullable: true,
    description: 'ISO 3166-1 alpha-2 country for tax jurisdiction',
  })
  taxCountryCode!: string | null;

  @Field(() => String, { nullable: true })
  taxPostalCode!: string | null;

  @Field(() => String, { nullable: true })
  taxProvince!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Optional tax provider code when multiple are active',
  })
  taxProviderCode!: string | null;

  @Field(() => String, {
    description: 'Last calculated tax amount in minor units',
  })
  taxMinor!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Coupon code for PromotionsEngine (D-01)',
  })
  couponCode!: string | null;

  @Field(() => String, {
    description: 'Last calculated discount amount in minor units',
  })
  discountMinor!: string;

  @Field(() => [CartLineType])
  lines!: CartLineType[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class CreateCartInput {
  @Field(() => ID, { nullable: true })
  customerId?: string;

  @Field(() => String, { nullable: true, defaultValue: 'USD' })
  currencyCode?: string;
}

@InputType()
export class AddCartLineInput {
  @Field(() => ID)
  cartId!: string;

  @Field(() => ID)
  variantId!: string;

  @Field(() => Int)
  quantity!: number;
}

@InputType()
export class UpdateCartLineInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  quantity!: number;
}

@ObjectType({
  description:
    'Checkout totals — shipping + TaxEngine tax + PromotionsEngine discount',
})
export class CheckoutTotalsType {
  @Field(() => String)
  currencyCode!: string;

  @Field(() => String)
  subtotalMinor!: string;

  @Field(() => String, {
    description: 'Promotion discount in minor units (D-01)',
  })
  discountMinor!: string;

  @Field(() => String)
  taxMinor!: string;

  @Field(() => String)
  shippingMinor!: string;

  @Field(() => String)
  totalMinor!: string;
}

@ObjectType({
  description:
    'Result of preparing checkout — reservations + totals (incl. shipping)',
})
export class CheckoutPreviewType {
  @Field(() => ID)
  cartId!: string;

  @Field(() => CartType)
  cart!: CartType;

  @Field(() => CheckoutTotalsType)
  totals!: CheckoutTotalsType;

  @Field(() => [ID], {
    description: 'Inventory reservation ids created for cart lines',
  })
  reservationIds!: string[];
}

@ObjectType({ description: 'Line item on a persisted order' })
export class OrderLineType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  orderId!: string;

  @Field(() => ID)
  variantId!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => String)
  unitPriceMinor!: string;

  @Field(() => String)
  lineTotalMinor!: string;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType({ description: 'Persisted commerce order' })
export class OrderType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { nullable: true })
  customerId!: string | null;

  @Field(() => ID, { nullable: true })
  cartId!: string | null;

  @Field(() => String)
  status!: string;

  @Field(() => String)
  currencyCode!: string;

  @Field(() => String)
  subtotalMinor!: string;

  @Field(() => String)
  taxMinor!: string;

  @Field(() => String)
  shippingMinor!: string;

  @Field(() => String, {
    description: 'Promotion discount in minor units (D-01)',
  })
  discountMinor!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Coupon code applied at checkout',
  })
  couponCode!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Selected shipping method provider code',
  })
  shippingMethodCode!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Selected shipping rate / service code',
  })
  shippingRateCode!: string | null;

  @Field(() => String)
  totalMinor!: string;

  @Field(() => [OrderLineType])
  lines!: OrderLineType[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType({
  description:
    'Select a shipping method/rate on a cart after ShippingEngine.quote',
})
export class SelectCartShippingInput {
  @Field(() => ID)
  cartId!: string;

  @Field(() => String, {
    description: 'Registered ShippingMethodProvider.code',
  })
  methodCode!: string;

  @Field(() => String, {
    description: 'Rate/service code from quoteRates',
  })
  rateCode!: string;

  @Field(() => String, {
    description: 'Destination country (ISO 3166-1 alpha-2)',
  })
  destinationCountryCode!: string;

  @Field(() => String, { nullable: true })
  destinationPostalCode?: string;
}

@InputType({
  description:
    'Set tax pricing mode and jurisdiction on a cart before prepareCheckout (C-03)',
})
export class SetCartTaxContextInput {
  @Field(() => ID)
  cartId!: string;

  @Field(() => String, {
    description: 'inclusive | exclusive',
    defaultValue: 'exclusive',
  })
  pricingMode?: string;

  @Field(() => String, {
    description: 'Destination country (ISO 3166-1 alpha-2)',
  })
  countryCode!: string;

  @Field(() => String, { nullable: true })
  postalCode?: string;

  @Field(() => String, { nullable: true })
  province?: string;

  @Field(() => String, {
    nullable: true,
    description: 'TaxProvider.code when multiple providers are active',
  })
  providerCode?: string;
}

@InputType({
  description:
    'Set or clear a coupon code on a cart for PromotionsEngine (D-01)',
})
export class SetCartCouponInput {
  @Field(() => ID)
  cartId!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Coupon code; omit or null to clear',
  })
  couponCode?: string | null;
}

@InputType({
  description:
    'Place order from a locked checkout cart via PaymentEngine',
})
export class PlaceOrderInput {
  @Field(() => ID)
  cartId!: string;

  @Field(() => String, {
    description:
      'Payment provider code (e.g. "manual"), or "zero" for free checkout (total must be 0; uses manual + capture)',
    defaultValue: 'manual',
  })
  paymentMethod?: string;
}

@InputType({ description: 'Transition an order to a new status' })
export class UpdateOrderStatusInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String, {
    description: 'Target status (pending|confirmed|fulfilled|cancelled)',
  })
  status!: string;
}
