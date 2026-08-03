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
  description: 'Checkout totals stub (tax/shipping zero until Phase 2)',
})
export class CheckoutTotalsType {
  @Field(() => String)
  currencyCode!: string;

  @Field(() => String)
  subtotalMinor!: string;

  @Field(() => String)
  taxMinor!: string;

  @Field(() => String)
  shippingMinor!: string;

  @Field(() => String)
  totalMinor!: string;
}

@ObjectType({
  description: 'Result of preparing checkout — reservations + totals stub',
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

  @Field(() => String)
  totalMinor!: string;

  @Field(() => [OrderLineType])
  lines!: OrderLineType[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
