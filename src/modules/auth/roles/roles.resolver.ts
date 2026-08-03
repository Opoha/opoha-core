import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from '../jwt/gql-auth.guard';
import { AssignRoleInput, RoleType } from './role.types';
import { RolesService } from './roles.service';

@Resolver(() => RoleType)
@UseGuards(GqlAuthGuard)
export class RolesResolver {
  constructor(private readonly rolesService: RolesService) {}

  @Query(() => [RoleType], {
    name: 'roles',
    description: 'List roles with permissions (authenticated staff only)',
  })
  roles(): Promise<RoleType[]> {
    return this.rolesService.findAll();
  }

  @Query(() => RoleType, {
    name: 'role',
    description: 'Get role by id (authenticated staff only)',
  })
  role(@Args('id', { type: () => ID }) id: string): Promise<RoleType> {
    return this.rolesService.findById(id);
  }

  @Mutation(() => RoleType, {
    name: 'assignRole',
    description: 'Assign a role to a staff user (authenticated staff only)',
  })
  assignRole(@Args('input', { type: () => AssignRoleInput }) input: AssignRoleInput): Promise<RoleType> {
    return this.rolesService.assignRole(input.userId, input.roleId);
  }

  @Mutation(() => RoleType, {
    name: 'removeRole',
    description: 'Remove a role from a staff user (authenticated staff only)',
  })
  removeRole(@Args('input', { type: () => AssignRoleInput }) input: AssignRoleInput): Promise<RoleType> {
    return this.rolesService.removeRole(input.userId, input.roleId);
  }
}
