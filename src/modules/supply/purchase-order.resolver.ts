import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderInput, PurchaseOrderType } from './purchase-order.types';

@Resolver(() => PurchaseOrderType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class PurchaseOrderResolver {
  constructor(private readonly purchaseOrderService: PurchaseOrderService) {}

  @Query(() => [PurchaseOrderType], {
    name: 'purchaseOrders',
    description: 'List purchase orders (optionally filtered by status)',
  })
  @RequirePermission('purchase-order:read')
  purchaseOrders(
    @Args('status', { type: () => String, nullable: true })
    status?: string,
  ): Promise<PurchaseOrderType[]> {
    return this.purchaseOrderService.findAll(
      status as 'draft' | 'received' | 'cancelled' | undefined,
    );
  }

  @Query(() => PurchaseOrderType, {
    name: 'purchaseOrder',
    description: 'Get a purchase order by id',
  })
  @RequirePermission('purchase-order:read')
  purchaseOrder(@Args('id', { type: () => ID }) id: string): Promise<PurchaseOrderType> {
    return this.purchaseOrderService.findById(id);
  }

  @Mutation(() => PurchaseOrderType, {
    name: 'createPurchaseOrder',
    description: 'Create a draft purchase order',
  })
  @RequirePermission('purchase-order:create')
  createPurchaseOrder(
    @Args('input', { type: () => CreatePurchaseOrderInput })
    input: CreatePurchaseOrderInput,
  ): Promise<PurchaseOrderType> {
    return this.purchaseOrderService.create(input);
  }

  @Mutation(() => PurchaseOrderType, {
    name: 'receivePurchaseOrder',
    description: 'Receive a draft PO into warehouse stock',
  })
  @RequirePermission('purchase-order:receive')
  receivePurchaseOrder(@Args('id', { type: () => ID }) id: string): Promise<PurchaseOrderType> {
    return this.purchaseOrderService.receive(id);
  }

  @Mutation(() => PurchaseOrderType, {
    name: 'cancelPurchaseOrder',
    description: 'Cancel a draft purchase order (no stock movement)',
  })
  @RequirePermission('purchase-order:cancel')
  cancelPurchaseOrder(@Args('id', { type: () => ID }) id: string): Promise<PurchaseOrderType> {
    return this.purchaseOrderService.cancel(id);
  }
}
