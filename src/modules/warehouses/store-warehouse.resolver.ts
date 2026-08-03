import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { StoreWarehouseService } from './store-warehouse.service';
import {
  LinkStoreWarehouseInput,
  StoreWarehouseType,
} from './store-warehouse.types';
import { WarehouseType } from './warehouse.types';

@Resolver(() => StoreWarehouseType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class StoreWarehouseResolver {
  constructor(private readonly storeWarehouseService: StoreWarehouseService) {}

  @Query(() => [StoreWarehouseType], {
    name: 'storeWarehouses',
    description: 'List warehouse associations for a store',
  })
  @RequirePermission('warehouse:read')
  storeWarehouses(
    @Args('storeId', { type: () => ID }) storeId: string,
  ): Promise<StoreWarehouseType[]> {
    return this.storeWarehouseService.listForStore(storeId);
  }

  @Query(() => [WarehouseType], {
    name: 'warehousesForStore',
    description: 'List warehouses allowed for a store (allocation allow-list)',
  })
  @RequirePermission('warehouse:read')
  warehousesForStore(
    @Args('storeId', { type: () => ID }) storeId: string,
  ): Promise<WarehouseType[]> {
    return this.storeWarehouseService.listWarehousesForStore(storeId);
  }

  @Mutation(() => StoreWarehouseType, {
    name: 'linkStoreWarehouse',
    description: 'Associate a warehouse with a store (optionally as primary)',
  })
  @RequirePermission('warehouse:update')
  linkStoreWarehouse(
    @Args('input', { type: () => LinkStoreWarehouseInput })
    input: LinkStoreWarehouseInput,
  ): Promise<StoreWarehouseType> {
    return this.storeWarehouseService.link(
      input.storeId,
      input.warehouseId,
      input.isPrimary === true,
    );
  }

  @Mutation(() => StoreWarehouseType, {
    name: 'unlinkStoreWarehouse',
    description: 'Remove a warehouse association from a store',
  })
  @RequirePermission('warehouse:update')
  unlinkStoreWarehouse(
    @Args('storeId', { type: () => ID }) storeId: string,
    @Args('warehouseId', { type: () => ID }) warehouseId: string,
  ): Promise<StoreWarehouseType> {
    return this.storeWarehouseService.unlink(storeId, warehouseId);
  }
}
