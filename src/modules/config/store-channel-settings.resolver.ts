import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { StoreChannelSettingsService } from './store-channel-settings.service';
import {
  StoreChannelSettingsType,
  UpdateStoreChannelSettingsInput,
} from './store-channel-settings.types';

@Resolver(() => StoreChannelSettingsType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class StoreChannelSettingsResolver {
  constructor(
    private readonly channelSettings: StoreChannelSettingsService,
  ) {}

  @Query(() => [StoreChannelSettingsType], {
    name: 'storeChannelSettingsList',
    description: 'List channel settings for all stores',
  })
  @RequirePermission('settings:read')
  storeChannelSettingsList(): Promise<StoreChannelSettingsType[]> {
    return this.channelSettings.findAll();
  }

  @Query(() => StoreChannelSettingsType, {
    name: 'storeChannelSettings',
    description:
      'Get store-scoped channel settings (creates defaults when missing)',
  })
  @RequirePermission('settings:read')
  storeChannelSettings(
    @Args('storeId', { type: () => ID }) storeId: string,
  ): Promise<StoreChannelSettingsType> {
    return this.channelSettings.getForStore(storeId);
  }

  @Mutation(() => StoreChannelSettingsType, {
    name: 'updateStoreChannelSettings',
    description: 'Update store-scoped channel settings',
  })
  @RequirePermission('settings:update')
  updateStoreChannelSettings(
    @Args('storeId', { type: () => ID }) storeId: string,
    @Args('input', { type: () => UpdateStoreChannelSettingsInput })
    input: UpdateStoreChannelSettingsInput,
  ): Promise<StoreChannelSettingsType> {
    return this.channelSettings.update(storeId, input);
  }
}
