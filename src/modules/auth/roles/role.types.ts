import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Permission key (`resource:action`)' })
export class PermissionType {
  @Field(() => ID)
  id!: string;

  @Field()
  key!: string;

  @Field({ nullable: true })
  description?: string | null;

  @Field()
  createdAt!: Date;
}

@ObjectType({ description: 'RBAC role aggregating permissions' })
export class RoleType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  description?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => [PermissionType], { nullable: true })
  permissions?: PermissionType[];
}

@InputType()
export class AssignRoleInput {
  @Field(() => ID)
  userId!: string;

  @Field(() => ID)
  roleId!: string;
}
