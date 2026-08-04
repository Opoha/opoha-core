import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('MarketplaceVendor', {
 description: 'Marketplace seller account',
})
export class VendorType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => ID, {
    nullable: true,
    description: 'Optional store channel this vendor sells through',
  })
  storeId!: string | null;

  @Field(() => Int, {
    description: 'Platform commission in basis points (1000 = 10%)',
  })
  commissionBps!: number;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => String, { nullable: true })
  email!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class CreateVendorInput {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => ID, { nullable: true })
  storeId?: string | null;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  commissionBps?: number;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => String, { nullable: true })
  email?: string | null;
}

@InputType()
export class UpdateVendorInput {
  @Field(() => String, { nullable: true })
  code?: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => ID, { nullable: true })
  storeId?: string | null;

  @Field(() => Int, { nullable: true })
  commissionBps?: number;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => String, { nullable: true })
  email?: string | null;
}

@InputType()
export class AssignProductVendorInput {
  @Field(() => ID)
  productId!: string;

  @Field(() => ID, {
    nullable: true,
    description: 'Marketplace vendor id; null clears association',
  })
  vendorId!: string | null;
}
