import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

import { RoleType } from '../roles/role.types';

@ObjectType({ description: 'Staff user account (password never exposed)' })
export class UserType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  email!: string;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => [RoleType], { nullable: 'itemsAndList' })
  roles?: RoleType[];
}

@InputType()
export class CreateUserInput {
  @Field(() => String)
  email!: string;

  @Field(() => String)
  password!: string;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  isActive?: boolean;
}

@InputType()
export class UpdateUserInput {
  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  password?: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}
