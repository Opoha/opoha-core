import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType('Supplier', {
  description: 'Vendor / supplier for purchase orders',
})
export class SupplierType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => String, { nullable: true })
  email!: string | null;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => String, { nullable: true })
  contactName!: string | null;

  @Field(() => String, { nullable: true })
  addressLine1!: string | null;

  @Field(() => String, { nullable: true })
  addressLine2!: string | null;

  @Field(() => String, { nullable: true })
  city!: string | null;

  @Field(() => String, { nullable: true })
  province!: string | null;

  @Field(() => String, { nullable: true })
  postalCode!: string | null;

  @Field(() => String, { nullable: true })
  countryCode!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class CreateSupplierInput {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field(() => String, { nullable: true })
  contactName?: string | null;

  @Field(() => String, { nullable: true })
  addressLine1?: string | null;

  @Field(() => String, { nullable: true })
  addressLine2?: string | null;

  @Field(() => String, { nullable: true })
  city?: string | null;

  @Field(() => String, { nullable: true })
  province?: string | null;

  @Field(() => String, { nullable: true })
  postalCode?: string | null;

  @Field(() => String, { nullable: true })
  countryCode?: string | null;
}

@InputType()
export class UpdateSupplierInput {
  @Field(() => String, { nullable: true })
  code?: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field(() => String, { nullable: true })
  contactName?: string | null;

  @Field(() => String, { nullable: true })
  addressLine1?: string | null;

  @Field(() => String, { nullable: true })
  addressLine2?: string | null;

  @Field(() => String, { nullable: true })
  city?: string | null;

  @Field(() => String, { nullable: true })
  province?: string | null;

  @Field(() => String, { nullable: true })
  postalCode?: string | null;

  @Field(() => String, { nullable: true })
  countryCode?: string | null;
}
