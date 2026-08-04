import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Stock levels for a product variant at a warehouse' })
export class InventoryItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  variantId!: string;

  @Field(() => ID)
  warehouseId!: string;

  @Field(() => Int)
  quantityOnHand!: number;

  @Field(() => Int)
  quantityReserved!: number;

  /** Available to sell = on hand − reserved. */
  @Field(() => Int)
  quantityAvailable!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType({ description: 'Stock reservation against an inventory item' })
export class InventoryReservationType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  inventoryItemId!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => String)
  status!: string;

  @Field(() => String, { nullable: true })
  reference!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType({ description: 'Audit row for a stock on-hand adjustment' })
export class InventoryAdjustmentType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  inventoryItemId!: string;

  @Field(() => Int)
  delta!: number;

  @Field(() => String, { nullable: true })
  reason!: string | null;

  @Field(() => Int)
  quantityOnHandAfter!: number;

  @Field(() => Date)
  createdAt!: Date;
}

@InputType()
export class CreateInventoryItemInput {
  @Field(() => ID)
  variantId!: string;

  @Field(() => ID, {
    nullable: true,
    description: 'Warehouse location; defaults to the default warehouse',
  })
  warehouseId?: string;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  quantityOnHand?: number;
}

@InputType()
export class AdjustInventoryInput {
  @Field(() => ID, {
    description: 'Product variant id whose stock to adjust',
  })
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

@InputType()
export class ReserveInventoryInput {
  @Field(() => ID)
  variantId!: string;

  @Field(() => ID, {
    nullable: true,
    description: 'Warehouse location; defaults to the default warehouse',
  })
  warehouseId?: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => String, { nullable: true })
  reference?: string;
}

/** Internal checkout reservation scoped to a store’s warehouse allow-list. */
export type ReserveInventoryForStoreInput = {
  variantId: string;
  storeId: string;
  quantity: number;
  warehouseId?: string | null;
  reference?: string;
};
