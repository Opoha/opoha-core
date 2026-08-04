import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType('StoreWarehouse', {
  description: 'Association between a store channel and an allowed warehouse',
})
export class StoreWarehouseType {
  @Field(() => ID)
  storeId!: string;

  @Field(() => ID)
  warehouseId!: string;

  @Field(() => Boolean)
  isPrimary!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class LinkStoreWarehouseInput {
  @Field(() => ID)
  storeId!: string;

  @Field(() => ID)
  warehouseId!: string;

  @Field(() => Boolean, {
    nullable: true,
    description: 'When true, becomes the store’s primary allocation warehouse',
  })
  isPrimary?: boolean;
}
