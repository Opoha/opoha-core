import { UseGuards } from '@nestjs/common';
import { Args, Context, ID, Mutation, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import type { StoreContextRef } from '../stores/public';
import { CheckoutService } from './checkout.service';
import { CheckoutPreviewType } from './order.types';

type GqlStoreContext = {
  storeContext?: StoreContextRef;
};

@Resolver(() => CheckoutPreviewType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class CheckoutResolver {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Mutation(() => CheckoutPreviewType, {
    name: 'prepareCheckout',
    description:
      'Validate stock via reservations and return totals; enforces cart store vs request store context (B-02)',
  })
  @RequirePermission('cart:checkout')
  prepareCheckout(
    @Args('cartId', { type: () => ID }) cartId: string,
    @Context() ctx: GqlStoreContext,
  ): Promise<CheckoutPreviewType> {
    return this.checkoutService.prepare(cartId, ctx.storeContext);
  }
}
