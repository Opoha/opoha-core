import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

import { ShippingAddressInput } from '../shipping-engine/public';
import type { FulfillmentStatus } from './entities';

@ObjectType('FulfillmentLine', {
  description: 'One order line (partial or full qty) allocated to a fulfillment',
})
export class FulfillmentLineType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  fulfillmentId!: string;

  @Field(() => ID)
  orderLineId!: string;

  @Field(() => ID)
  variantId!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('FulfillmentPackage', {
  description: 'Shipped package on a fulfillment (tracking + label, D-04)',
})
export class FulfillmentPackageType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  fulfillmentId!: string;

  @Field(() => String, { nullable: true })
  trackingNumber!: string | null;

  @Field(() => String, { nullable: true })
  carrierCode!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Label URL from ShippingMethodProvider.createLabel',
  })
  labelUrl!: string | null;

  @Field(() => Int, { nullable: true })
  weightGrams!: number | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('Fulfillment', {
  description: 'Pick → pack → ship workflow for a subset of an order',
})
export class FulfillmentType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  orderId!: string;

  @Field(() => ID)
  warehouseId!: string;

  @Field(() => String)
  status!: FulfillmentStatus;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => String, { nullable: true })
  trackingNumber!: string | null;

  @Field(() => Date, { nullable: true })
  pickedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  packedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  shippedAt!: Date | null;

  @Field(() => [FulfillmentLineType])
  lines!: FulfillmentLineType[];

  @Field(() => [FulfillmentPackageType])
  packages!: FulfillmentPackageType[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class FulfillmentLineInput {
  @Field(() => ID)
  orderLineId!: string;

  @Field(() => Int)
  quantity!: number;
}

@InputType()
export class FulfillmentPackageInput {
  @Field(() => String, { nullable: true })
  trackingNumber?: string | null;

  @Field(() => String, { nullable: true })
  carrierCode?: string | null;

  @Field(() => String, { nullable: true })
  labelUrl?: string | null;

  @Field(() => Int, { nullable: true })
  weightGrams?: number | null;
}

@InputType()
export class CreateFulfillmentInput {
  @Field(() => ID)
  orderId!: string;

  @Field(() => ID)
  warehouseId!: string;

  @Field(() => [FulfillmentLineInput])
  lines!: FulfillmentLineInput[];

  @Field(() => String, { nullable: true })
  notes?: string | null;
}

@InputType()
export class PackFulfillmentInput {
  @Field(() => [FulfillmentPackageInput], { nullable: true })
  packages?: FulfillmentPackageInput[];
}

@InputType()
export class ShipFulfillmentInput {
  @Field(() => String, { nullable: true })
  trackingNumber?: string | null;

  /**
   * Destination for ShippingMethodProvider.createLabel when the order's
   * shipping method supports labels. Falls back to warehouse country / US.
   */
  @Field(() => ShippingAddressInput, { nullable: true })
  destination?: ShippingAddressInput;

  /** When true, skip createLabel even if the provider implements it. */
  @Field(() => Boolean, { nullable: true })
  skipLabel?: boolean | null;
}
