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
    description: 'List inventory items (optionally filtered by warehouse)',
  })
  @RequirePermission('inventory:read')
  inventoryItems(
    @Args('warehouseId', { type: () => ID, nullable: true })
    warehouseId?: string,
  ): Promise<InventoryItemType[]> {
    return this.inventoryService.findAll(warehouseId);
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
    description:
      'Get inventory item by product variant id (default warehouse when warehouseId omitted)',
  })
  @RequirePermission('inventory:read')
  inventoryItemByVariant(
    @Args('variantId', { type: () => ID }) variantId: string,
    @Args('warehouseId', { type: () => ID, nullable: true })
    warehouseId?: string,
  ): Promise<InventoryItemType> {
    return this.inventoryService.findByVariantId(variantId, warehouseId);
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
    description:
      'Create an inventory item for a product variant at a warehouse',
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
    description: 'Apply a signed on-hand stock adjustment at a warehouse',
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
    description:
      'Reserve available stock for a variant at a warehouse (transactional)',
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
