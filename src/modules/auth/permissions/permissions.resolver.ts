import { UseGuards } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from '../jwt/gql-auth.guard';
import { PermissionType } from '../roles/role.types';
import { PermissionsService } from './permissions.service';

@Resolver(() => PermissionType)
@UseGuards(GqlAuthGuard)
export class PermissionsResolver {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Query(() => [PermissionType], {
    name: 'permissions',
    description: 'List permission keys (authenticated staff only)',
  })
  permissions(): Promise<PermissionType[]> {
    return this.permissionsService.findAll();
  }

  @Query(() => PermissionType, {
    name: 'permission',
    description: 'Get permission by id (authenticated staff only)',
  })
  permission(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PermissionType> {
    return this.permissionsService.findById(id);
  }
}
