import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Customer shipping/billing address' })
export class CustomerAddressType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => String, { nullable: true })
  label!: string | null;

  @Field(() => String)
  firstName!: string;

  @Field(() => String)
  lastName!: string;

  @Field(() => String, { nullable: true })
  company!: string | null;

  @Field(() => String)
  line1!: string;

  @Field(() => String, { nullable: true })
  line2!: string | null;

  @Field(() => String)
  city!: string;

  @Field(() => String, { nullable: true })
  province!: string | null;

  @Field(() => String)
  postalCode!: string;

  @Field(() => String)
  countryCode!: string;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => Boolean)
  isDefault!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class CreateCustomerAddressInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => String, { nullable: true })
  label?: string;

  @Field(() => String)
  firstName!: string;

  @Field(() => String)
  lastName!: string;

  @Field(() => String, { nullable: true })
  company?: string;

  @Field(() => String)
  line1!: string;

  @Field(() => String, { nullable: true })
  line2?: string;

  @Field(() => String)
  city!: string;

  @Field(() => String, { nullable: true })
  province?: string;

  @Field(() => String)
  postalCode!: string;

  @Field(() => String, { description: 'ISO 3166-1 alpha-2 country code' })
  countryCode!: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  isDefault?: boolean;
}

@InputType()
export class UpdateCustomerAddressInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  label?: string;

  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  company?: string;

  @Field(() => String, { nullable: true })
  line1?: string;

  @Field(() => String, { nullable: true })
  line2?: string;

  @Field(() => String, { nullable: true })
  city?: string;

  @Field(() => String, { nullable: true })
  province?: string;

  @Field(() => String, { nullable: true })
  postalCode?: string;

  @Field(() => String, {
    nullable: true,
    description: 'ISO 3166-1 alpha-2 country code',
  })
  countryCode?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => Boolean, { nullable: true })
  isDefault?: boolean;
}
