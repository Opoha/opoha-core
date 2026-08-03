import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../auth/public';
import {
  CurrentUser,
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { PluginManagementService } from './plugin-management.service';
import { PluginType, UpdatePluginConfigInput } from './plugins.types';

/**
 * Staff GraphQL for plugin management (F-07 / AC-MVP-031).
 */
@Resolver(() => PluginType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class PluginsResolver {
  constructor(private readonly plugins: PluginManagementService) {}

  @Query(() => [PluginType], {
    name: 'plugins',
    description: 'List discovered plugins with durable enable/config state',
  })
  @RequirePermission('plugin:read')
  list(): Promise<PluginType[]> {
    return this.plugins.list();
  }

  @Query(() => PluginType, {
    name: 'plugin',
    description: 'Get a plugin by id',
  })
  @RequirePermission('plugin:read')
  get(@Args('id', { type: () => ID }) id: string): Promise<PluginType> {
    return this.plugins.get(id);
  }

  @Mutation(() => PluginType, {
    name: 'enablePlugin',
    description: 'Install (if needed) and enable a plugin',
  })
  @RequirePermission('plugin:manage')
  enable(
    @CurrentUser() actor: AuthUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PluginType> {
    return this.plugins.enable(id, actor.userId);
  }

  @Mutation(() => PluginType, {
    name: 'disablePlugin',
    description: 'Disable an enabled plugin',
  })
  @RequirePermission('plugin:manage')
  disable(
    @CurrentUser() actor: AuthUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PluginType> {
    return this.plugins.disable(id, actor.userId);
  }

  @Mutation(() => PluginType, {
    name: 'updatePluginConfig',
    description: 'Persist opaque JSON config for a plugin (admin configure)',
  })
  @RequirePermission('plugin:manage')
  updateConfig(
    @CurrentUser() actor: AuthUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdatePluginConfigInput })
    input: UpdatePluginConfigInput,
  ): Promise<PluginType> {
    return this.plugins.updateConfig(id, input.configJson, actor.userId);
  }
}
