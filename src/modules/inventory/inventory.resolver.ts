import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { InventoryService } from './inventory.service';
import {
  AdjustInventoryInput,
  CreateInventoryItemInput,
  InventoryAdjustmentType,
  InventoryItemType,
  InventoryReservationType,
  ReserveInventoryInput,
} from './inventory.types';

@Resolver(() => InventoryItemType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class InventoryResolver {
  constructor(private readonly inventoryService: InventoryService) {}

  @Query(() => [InventoryItemType], {
    name: 'inventoryItems',
    description: 'List inventory items',
  })
  @RequirePermission('inventory:read')
  inventoryItems(): Promise<InventoryItemType[]> {
    return this.inventoryService.findAll();
  }

  @Query(() => InventoryItemType, {
    name: 'inventoryItem',
    description: 'Get inventory item by id',
  })
  @RequirePermission('inventory:read')
  inventoryItem(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<InventoryItemType> {
    return this.inventoryService.findById(id);
  }

  @Query(() => InventoryItemType, {
    name: 'inventoryItemByVariant',
    description: 'Get inventory item by product variant id',
  })
  @RequirePermission('inventory:read')
  inventoryItemByVariant(
    @Args('variantId', { type: () => ID }) variantId: string,
  ): Promise<InventoryItemType> {
    return this.inventoryService.findByVariantId(variantId);
  }

  @Query(() => [InventoryAdjustmentType], {
    name: 'inventoryAdjustments',
    description: 'List adjustments for an inventory item',
  })
  @RequirePermission('inventory:read')
  inventoryAdjustments(
    @Args('inventoryItemId', { type: () => ID }) inventoryItemId: string,
  ): Promise<InventoryAdjustmentType[]> {
    return this.inventoryService.listAdjustments(inventoryItemId);
  }

  @Mutation(() => InventoryItemType, {
    name: 'createInventoryItem',
    description: 'Create an inventory item for a product variant',
  })
  @RequirePermission('inventory:create')
  createInventoryItem(
    @Args('input', { type: () => CreateInventoryItemInput })
    input: CreateInventoryItemInput,
  ): Promise<InventoryItemType> {
    return this.inventoryService.create(input);
  }

  @Mutation(() => InventoryItemType, {
    name: 'adjustInventory',
    description: 'Apply a signed on-hand stock adjustment',
  })
  @RequirePermission('inventory:adjust')
  adjustInventory(
    @Args('input', { type: () => AdjustInventoryInput })
    input: AdjustInventoryInput,
  ): Promise<InventoryItemType> {
    return this.inventoryService.adjust(input);
  }

  @Mutation(() => InventoryReservationType, {
    name: 'reserveInventory',
    description: 'Reserve available stock for a variant (transactional)',
  })
  @RequirePermission('inventory:reserve')
  reserveInventory(
    @Args('input', { type: () => ReserveInventoryInput })
    input: ReserveInventoryInput,
  ): Promise<InventoryReservationType> {
    return this.inventoryService.reserve(input);
  }

  @Mutation(() => InventoryReservationType, {
    name: 'releaseInventoryReservation',
    description: 'Release an active inventory reservation',
  })
  @RequirePermission('inventory:release')
  releaseInventoryReservation(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<InventoryReservationType> {
    return this.inventoryService.release(id);
  }
}
