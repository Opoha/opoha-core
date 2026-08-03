import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Named customer segment / group' })
export class CustomerGroupType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType({ description: 'Customer ↔ group membership' })
export class CustomerGroupMembershipType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => ID)
  groupId!: string;

  @Field(() => Date)
  createdAt!: Date;
}

@InputType()
export class CreateCustomerGroupInput {
  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string;
}

@InputType()
export class UpdateCustomerGroupInput {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string;
}

@InputType()
export class AddCustomerToGroupInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => ID)
  groupId!: string;
}
