import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
} from '@nestjs/graphql';

@ObjectType({ description: 'Line item on a purchase order' })
export class PurchaseOrderLineType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  purchaseOrderId!: string;

  @Field(() => ID)
  variantId!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Int)
  quantityReceived!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType({
  description: 'Purchase order (draft → receive into warehouse stock)',
})
export class PurchaseOrderType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  supplierId!: string;

  @Field(() => ID)
  warehouseId!: string;

  @Field(() => String)
  status!: string;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => Date, { nullable: true })
  receivedAt!: Date | null;

  @Field(() => [PurchaseOrderLineType])
  lines!: PurchaseOrderLineType[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class PurchaseOrderLineInput {
  @Field(() => ID)
  variantId!: string;

  @Field(() => Int)
  quantity!: number;
}

@InputType()
export class CreatePurchaseOrderInput {
  @Field(() => ID)
  supplierId!: string;

  @Field(() => ID)
  warehouseId!: string;

  @Field(() => [PurchaseOrderLineInput])
  lines!: PurchaseOrderLineInput[];

  @Field(() => String, { nullable: true })
  notes?: string;
}
