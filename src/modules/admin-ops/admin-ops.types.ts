import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
} from '@nestjs/graphql';

@ObjectType({ description: 'Order count and revenue for one status' })
export class OrdersReportStatusRow {
  @Field(() => String)
  status!: string;

  @Field(() => Int)
  orderCount!: number;

  @Field(() => String, {
    description: 'Sum of total_minor for orders in this status (integer string)',
  })
  totalMinorSum!: string;
}

@ObjectType({ description: 'Aggregated orders report (sales)' })
export class OrdersReportType {
  @Field(() => Int)
  orderCount!: number;

  @Field(() => String, {
    description: 'Sum of total_minor across matching orders (integer string)',
  })
  totalMinorSum!: string;

  @Field(() => [OrdersReportStatusRow])
  byStatus!: OrdersReportStatusRow[];

  @Field(() => GraphQLISODateTime, { nullable: true })
  from!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  to!: Date | null;
}

@ObjectType({ description: 'Inventory totals for one warehouse' })
export class InventoryByWarehouseRow {
  @Field(() => ID)
  warehouseId!: string;

  @Field(() => String, { nullable: true })
  warehouseCode!: string | null;

  @Field(() => String, { nullable: true })
  warehouseName!: string | null;

  @Field(() => Int)
  skuCount!: number;

  @Field(() => Int)
  quantityOnHand!: number;

  @Field(() => Int)
  quantityReserved!: number;

  @Field(() => Int)
  quantityAvailable!: number;
}

@ObjectType({ description: 'Fulfillment counts for one status' })
export class FulfillmentThroughputStatusRow {
  @Field(() => String)
  status!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType({
  description: 'Fulfillment throughput (created / shipped in window)',
})
export class FulfillmentThroughputType {
  @Field(() => Int)
  createdCount!: number;

  @Field(() => Int)
  shippedCount!: number;

  @Field(() => [FulfillmentThroughputStatusRow])
  byStatus!: FulfillmentThroughputStatusRow[];

  @Field(() => GraphQLISODateTime, { nullable: true })
  from!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  to!: Date | null;
}

@InputType()
export class BulkUpdateProductItemInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  slug?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}

@InputType()
export class BulkAdjustInventoryItemInput {
  @Field(() => ID)
  variantId!: string;

  @Field(() => ID, {
    nullable: true,
    description: 'Warehouse location; defaults to the default warehouse',
  })
  warehouseId?: string;

  @Field(() => Int, {
    description: 'Signed delta applied to quantityOnHand (e.g. +10 or -3)',
  })
  delta!: number;

  @Field(() => String, { nullable: true })
  reason?: string;
}

@ObjectType({ description: 'Per-item outcome for a bulk product update' })
export class BulkProductItemResult {
  @Field(() => ID)
  id!: string;

  @Field(() => Boolean)
  ok!: boolean;

  @Field(() => String, { nullable: true })
  error!: string | null;
}

@ObjectType({ description: 'Summary of a bulk product update' })
export class BulkUpdateProductsResult {
  @Field(() => Int)
  successCount!: number;

  @Field(() => Int)
  failureCount!: number;

  @Field(() => [BulkProductItemResult])
  results!: BulkProductItemResult[];
}

@ObjectType({ description: 'Per-item outcome for a bulk inventory adjust' })
export class BulkInventoryItemResult {
  @Field(() => ID)
  variantId!: string;

  @Field(() => ID, { nullable: true })
  warehouseId!: string | null;

  @Field(() => Boolean)
  ok!: boolean;

  @Field(() => ID, { nullable: true })
  inventoryItemId!: string | null;

  @Field(() => String, { nullable: true })
  error!: string | null;
}

@ObjectType({ description: 'Summary of a bulk inventory adjust' })
export class BulkAdjustInventoryResult {
  @Field(() => Int)
  successCount!: number;

  @Field(() => Int)
  failureCount!: number;

  @Field(() => [BulkInventoryItemResult])
  results!: BulkInventoryItemResult[];
}
