import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { CheckoutService } from './checkout.service';
import { CheckoutPreviewType } from './order.types';

@Resolver(() => CheckoutPreviewType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class CheckoutResolver {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Mutation(() => CheckoutPreviewType, {
    name: 'prepareCheckout',
    description:
      'Validate stock via reservations and return totals stub (tax/shipping = 0)',
  })
  @RequirePermission('cart:checkout')
  prepareCheckout(
    @Args('cartId', { type: () => ID }) cartId: string,
  ): Promise<CheckoutPreviewType> {
    return this.checkoutService.prepare(cartId);
  }
}
