import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'B2B company account' })
export class CompanyType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  storeId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, {
    nullable: true,
 description: 'Credit limit in minor units; null = unset',
  })
  creditLimitMinor!: string | null;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType({ description: 'Buyer membership on a B2B company' })
export class CompanyMembershipType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  companyId!: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => String, {
    description: 'buyer | approver | admin',
  })
  role!: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class CreateCompanyInput {
  @Field(() => ID)
  storeId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  creditLimitMinor?: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}

@InputType()
export class UpdateCompanyInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  creditLimitMinor?: string | null;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}

@InputType()
export class AddCompanyMemberInput {
  @Field(() => ID)
  companyId!: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => String, {
    description: 'buyer | approver | admin',
  })
  role!: string;
}

@InputType()
export class UpdateCompanyMemberRoleInput {
  @Field(() => ID)
  companyId!: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => String)
  role!: string;
}

@InputType()
export class RemoveCompanyMemberInput {
  @Field(() => ID)
  companyId!: string;

  @Field(() => ID)
  customerId!: string;
}

@ObjectType({ description: 'Customer-specific price list item' })
export class CompanyPriceListItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  companyId!: string;

  @Field(() => ID)
  variantId!: string;

  @Field(() => String)
  priceMinor!: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class SetCompanyPriceListItemInput {
  @Field(() => ID)
  companyId!: string;

  @Field(() => ID)
  variantId!: string;

  @Field(() => String, {
    description: 'Negotiated price in minor units (non-negative integer)',
  })
  priceMinor!: string;
}

@InputType()
export class RemoveCompanyPriceListItemInput {
  @Field(() => ID)
  companyId!: string;

  @Field(() => ID)
  variantId!: string;
}

@InputType()
export class ApproveB2bOrderInput {
  @Field(() => ID)
  orderId!: string;

  @Field(() => ID, {
    description: 'Approver customer id (must be approver or admin)',
  })
  approverCustomerId!: string;
}

@InputType()
export class ConfirmB2bOrderInput {
  @Field(() => ID)
  orderId!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Payment method / provider code (default: manual)',
  })
  paymentMethod?: string;
}
