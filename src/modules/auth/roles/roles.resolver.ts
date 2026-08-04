import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../jwt/auth-user';
import { CurrentUser } from '../jwt/current-user.decorator';
import { GqlAuthGuard } from '../jwt/gql-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { AssignRoleInput, CreateRoleInput, RoleType, UpdateRoleInput } from './role.types';
import { RolesService } from './roles.service';

@Resolver(() => RoleType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class RolesResolver {
  constructor(private readonly rolesService: RolesService) {}

  @Query(() => [RoleType], {
    name: 'roles',
    description: 'List roles with permissions',
  })
  @RequirePermission('role:read')
  roles(): Promise<RoleType[]> {
    return this.rolesService.findAll();
  }

  @Query(() => RoleType, {
    name: 'role',
    description: 'Get role by id',
  })
  @RequirePermission('role:read')
  role(@Args('id', { type: () => ID }) id: string): Promise<RoleType> {
    return this.rolesService.findById(id);
  }

  @Mutation(() => RoleType, {
    name: 'createRole',
    description: 'Create a role with optional permissions',
  })
  @RequirePermission('role:create')
  createRole(
    @CurrentUser() actor: AuthUser,
    @Args('input', { type: () => CreateRoleInput }) input: CreateRoleInput,
  ): Promise<RoleType> {
    return this.rolesService.create(input, actor.userId);
  }

  @Mutation(() => RoleType, {
    name: 'updateRole',
    description: 'Update a role name, description, and/or permissions',
  })
  @RequirePermission('role:update')
  updateRole(
    @CurrentUser() actor: AuthUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateRoleInput }) input: UpdateRoleInput,
  ): Promise<RoleType> {
    return this.rolesService.update(id, input, actor.userId);
  }

  @Mutation(() => RoleType, {
    name: 'deleteRole',
    description: 'Delete a role (default admin role is protected)',
  })
  @RequirePermission('role:delete')
  deleteRole(
    @CurrentUser() actor: AuthUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<RoleType> {
    return this.rolesService.remove(id, actor.userId);
  }

  @Mutation(() => RoleType, {
    name: 'assignRole',
    description: 'Assign a role to a staff user',
  })
  @RequirePermission('role:update')
  assignRole(
    @CurrentUser() actor: AuthUser,
    @Args('input', { type: () => AssignRoleInput }) input: AssignRoleInput,
  ): Promise<RoleType> {
    return this.rolesService.assignRole(input.userId, input.roleId, actor.userId);
  }

  @Mutation(() => RoleType, {
    name: 'removeRole',
    description: 'Remove a role from a staff user',
  })
  @RequirePermission('role:update')
  removeRole(
    @CurrentUser() actor: AuthUser,
    @Args('input', { type: () => AssignRoleInput }) input: AssignRoleInput,
  ): Promise<RoleType> {
    return this.rolesService.removeRole(input.userId, input.roleId, actor.userId);
  }
}
