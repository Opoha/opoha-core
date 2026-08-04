import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { StoreService } from './store.service';
import { CreateStoreInput, StoreType, UpdateStoreInput } from './store.types';

@Resolver(() => StoreType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class StoreResolver {
  constructor(private readonly storeService: StoreService) {}

  @Query(() => [StoreType], {
    name: 'stores',
    description: 'List application stores / brands',
  })
  @RequirePermission('store:read')
  stores(): Promise<StoreType[]> {
    return this.storeService.findAll();
  }

  @Query(() => StoreType, {
    name: 'store',
    description: 'Get store by id',
  })
  @RequirePermission('store:read')
  store(@Args('id', { type: () => ID }) id: string): Promise<StoreType> {
    return this.storeService.findById(id);
  }

  @Query(() => StoreType, {
    name: 'storeByCode',
    description: 'Get store by stable code',
  })
  @RequirePermission('store:read')
  storeByCode(@Args('code', { type: () => String }) code: string): Promise<StoreType> {
    return this.storeService.findByCode(code);
  }

  @Query(() => StoreType, {
    name: 'defaultStore',
    description: 'Get the default store when configured',
    nullable: true,
  })
  @RequirePermission('store:read')
  defaultStore(): Promise<StoreType | null> {
    return this.storeService.findDefault();
  }

  @Mutation(() => StoreType, {
    name: 'createStore',
    description: 'Create an application store / brand',
  })
  @RequirePermission('store:create')
  createStore(
    @Args('input', { type: () => CreateStoreInput })
    input: CreateStoreInput,
  ): Promise<StoreType> {
    return this.storeService.create(input);
  }

  @Mutation(() => StoreType, {
    name: 'updateStore',
    description: 'Update an application store / brand',
  })
  @RequirePermission('store:update')
  updateStore(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => UpdateStoreInput })
    input: UpdateStoreInput,
  ): Promise<StoreType> {
    return this.storeService.update(id, input);
  }

  @Mutation(() => StoreType, {
    name: 'deleteStore',
    description: 'Delete a non-default store',
  })
  @RequirePermission('store:delete')
  deleteStore(@Args('id', { type: () => ID }) id: string): Promise<StoreType> {
    return this.storeService.remove(id);
  }
}
