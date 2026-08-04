import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Line item on a stock transfer' })
export class StockTransferLineType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  transferId!: string;

  @Field(() => ID)
  variantId!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType({
  description: 'Stock transfer between warehouses (draft → ship → receive)',
})
export class StockTransferType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  fromWarehouseId!: string;

  @Field(() => ID)
  toWarehouseId!: string;

  @Field(() => String)
  status!: string;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => Date, { nullable: true })
  shippedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  receivedAt!: Date | null;

  @Field(() => [StockTransferLineType])
  lines!: StockTransferLineType[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class StockTransferLineInput {
  @Field(() => ID)
  variantId!: string;

  @Field(() => Int)
  quantity!: number;
}

@InputType()
export class CreateStockTransferInput {
  @Field(() => ID)
  fromWarehouseId!: string;

  @Field(() => ID)
  toWarehouseId!: string;

  @Field(() => ID, {
    nullable: true,
 description: 'Optional store scope — both warehouses must be linked to this store',
  })
  storeId?: string;

  @Field(() => [StockTransferLineInput])
  lines!: StockTransferLineInput[];

  @Field(() => String, { nullable: true })
  notes?: string;
}
