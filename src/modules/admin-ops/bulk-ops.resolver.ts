import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../auth/public';
import {
  CurrentUser,
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import {
  BulkAdjustInventoryItemInput,
  BulkAdjustInventoryResult,
  BulkUpdateProductItemInput,
  BulkUpdateProductsResult,
} from './admin-ops.types';
import { BulkOpsService } from './bulk-ops.service';

@Resolver()
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class BulkOpsResolver {
  constructor(private readonly bulkOps: BulkOpsService) {}

  @Mutation(() => BulkUpdateProductsResult, {
    name: 'bulkUpdateProducts',
    description:
      'Batch-update catalog products (continues on per-item errors; max 100)',
  })
  @RequirePermission('bulk:product')
  bulkUpdateProducts(
    @CurrentUser() actor: AuthUser,
    @Args('items', { type: () => [BulkUpdateProductItemInput] })
    items: BulkUpdateProductItemInput[],
  ): Promise<BulkUpdateProductsResult> {
    return this.bulkOps.bulkUpdateProducts(items, actor.userId);
  }

  @Mutation(() => BulkAdjustInventoryResult, {
    name: 'bulkAdjustInventory',
    description:
      'Batch stock adjustments (continues on per-item errors; max 100)',
  })
  @RequirePermission('bulk:inventory')
  bulkAdjustInventory(
    @CurrentUser() actor: AuthUser,
    @Args('items', { type: () => [BulkAdjustInventoryItemInput] })
    items: BulkAdjustInventoryItemInput[],
  ): Promise<BulkAdjustInventoryResult> {
    return this.bulkOps.bulkAdjustInventory(items, actor.userId);
  }
}
