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
      'Validate stock via reservations and return settlement + display totals; ' +
      'enforces cart store vs request store context (B-02). ' +
      'displayCurrencyCode must be enabled for the store (D-03); defaults to primary display.',
  })
  @RequirePermission('cart:checkout')
  prepareCheckout(
    @Args('cartId', { type: () => ID }) cartId: string,
    @Args('displayCurrencyCode', {
      type: () => String,
      nullable: true,
      description:
        'Optional display currency (ISO 4217); defaults to store displayCurrencyCode',
    })
    displayCurrencyCode: string | undefined,
    @Context() ctx: GqlStoreContext,
  ): Promise<CheckoutPreviewType> {
    return this.checkoutService.prepare(
      cartId,
      ctx.storeContext,
      displayCurrencyCode,
    );
  }
}
