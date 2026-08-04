import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { StoreCurrencyConfigService } from './store-currency-config.service';
import {
  StoreCurrencyConfigType,
  UpdateStoreCurrencyConfigInput,
} from './store-currency-config.types';

@Resolver(() => StoreCurrencyConfigType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class StoreCurrencyConfigResolver {
  constructor(private readonly currencyConfig: StoreCurrencyConfigService) {}

  @Query(() => [StoreCurrencyConfigType], {
    name: 'storeCurrencyConfigList',
    description: 'List currency configs for all stores',
  })
  @RequirePermission('currency:read')
  storeCurrencyConfigList(): Promise<StoreCurrencyConfigType[]> {
    return this.currencyConfig.findAll();
  }

  @Query(() => StoreCurrencyConfigType, {
    name: 'storeCurrencyConfig',
    description:
      'Get store-scoped display/settlement currency config (creates defaults when missing)',
  })
  @RequirePermission('currency:read')
  storeCurrencyConfig(
    @Args('storeId', { type: () => ID }) storeId: string,
  ): Promise<StoreCurrencyConfigType> {
    return this.currencyConfig.getForStore(storeId);
  }

  @Mutation(() => StoreCurrencyConfigType, {
    name: 'updateStoreCurrencyConfig',
    description: 'Update store-scoped display vs settlement currency config',
  })
  @RequirePermission('currency:update')
  updateStoreCurrencyConfig(
    @Args('storeId', { type: () => ID }) storeId: string,
    @Args('input', { type: () => UpdateStoreCurrencyConfigInput })
    input: UpdateStoreCurrencyConfigInput,
  ): Promise<StoreCurrencyConfigType> {
    return this.currencyConfig.update(storeId, input);
  }
}
