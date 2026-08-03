import { UseGuards } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from '../jwt/gql-auth.guard';
import { PermissionType } from '../roles/role.types';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from './permissions.service';
import { RequirePermission } from './require-permission.decorator';

@Resolver(() => PermissionType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class PermissionsResolver {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Query(() => [PermissionType], {
    name: 'permissions',
    description: 'List permission keys',
  })
  @RequirePermission('permission:read')
  permissions(): Promise<PermissionType[]> {
    return this.permissionsService.findAll();
  }

  @Query(() => PermissionType, {
    name: 'permission',
    description: 'Get permission by id',
  })
  @RequirePermission('permission:read')
  permission(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PermissionType> {
    return this.permissionsService.findById(id);
  }
}
