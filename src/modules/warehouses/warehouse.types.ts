import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType('Warehouse', {
  description: 'Inventory location / warehouse',
})
export class WarehouseType {
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

  @Field(() => Boolean)
  isDefault!: boolean;

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
export class CreateWarehouseInput {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => Boolean, { nullable: true })
  isDefault?: boolean;

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
export class UpdateWarehouseInput {
  @Field(() => String, { nullable: true })
  code?: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => Boolean, { nullable: true })
  isDefault?: boolean;

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
