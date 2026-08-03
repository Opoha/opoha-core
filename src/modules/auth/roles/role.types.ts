import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Permission key (`resource:action`)' })
export class PermissionType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  key!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType({ description: 'RBAC role aggregating permissions' })
export class RoleType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => [PermissionType], { nullable: 'itemsAndList' })
  permissions?: PermissionType[];
}

@InputType()
export class AssignRoleInput {
  @Field(() => ID)
  userId!: string;

  @Field(() => ID)
  roleId!: string;
}

@InputType()
export class CreateRoleInput {
  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => [ID], { nullable: true })
  permissionIds?: string[];
}

@InputType()
export class UpdateRoleInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => [ID], { nullable: true })
  permissionIds?: string[];
}
