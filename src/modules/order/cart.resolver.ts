import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { CartService } from './cart.service';
import {
  AddCartLineInput,
  CartType,
  CreateCartInput,
  SelectCartShippingInput,
  SetCartCouponInput,
  SetCartTaxContextInput,
  UpdateCartLineInput,
} from './order.types';

@Resolver(() => CartType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class CartResolver {
  constructor(private readonly cartService: CartService) {}

  @Query(() => [CartType], {
    name: 'carts',
    description: 'List shopping carts',
  })
  @RequirePermission('cart:read')
  carts(): Promise<CartType[]> {
    return this.cartService.findAll();
  }

  @Query(() => CartType, {
    name: 'cart',
    description: 'Get cart by id',
  })
  @RequirePermission('cart:read')
  cart(@Args('id', { type: () => ID }) id: string): Promise<CartType> {
    return this.cartService.findById(id);
  }

  @Mutation(() => CartType, {
    name: 'createCart',
    description: 'Create an empty shopping cart',
  })
  @RequirePermission('cart:create')
  createCart(
    @Args('input', { type: () => CreateCartInput, nullable: true })
    input?: CreateCartInput,
  ): Promise<CartType> {
    return this.cartService.create(input ?? {});
  }

  @Mutation(() => CartType, {
    name: 'addCartLine',
    description: 'Add or merge a variant line into a cart',
  })
  @RequirePermission('cart:update')
  addCartLine(
    @Args('input', { type: () => AddCartLineInput }) input: AddCartLineInput,
  ): Promise<CartType> {
    return this.cartService.addLine(input);
  }

  @Mutation(() => CartType, {
    name: 'updateCartLine',
    description: 'Update quantity on a cart line',
  })
  @RequirePermission('cart:update')
  updateCartLine(
    @Args('input', { type: () => UpdateCartLineInput })
    input: UpdateCartLineInput,
  ): Promise<CartType> {
    return this.cartService.updateLine(input);
  }

  @Mutation(() => CartType, {
    name: 'removeCartLine',
    description: 'Remove a line from a cart',
  })
  @RequirePermission('cart:update')
  removeCartLine(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CartType> {
    return this.cartService.removeLine(id);
  }

  @Mutation(() => CartType, {
    name: 'selectCartShipping',
    description:
      'Validate a shipping rate via ShippingEngine and persist selection on the cart',
  })
  @RequirePermission('cart:update')
  selectCartShipping(
    @Args('input', { type: () => SelectCartShippingInput })
    input: SelectCartShippingInput,
  ): Promise<CartType> {
    return this.cartService.selectShipping(input);
  }

  @Mutation(() => CartType, {
    name: 'setCartTaxContext',
    description:
      'Set tax pricing mode and jurisdiction on a cart for TaxEngine checkout calc',
  })
  @RequirePermission('cart:update')
  setCartTaxContext(
    @Args('input', { type: () => SetCartTaxContextInput })
    input: SetCartTaxContextInput,
  ): Promise<CartType> {
    return this.cartService.setTaxContext(input);
  }

  @Mutation(() => CartType, {
    name: 'setCartCoupon',
    description:
      'Set or clear a coupon code on a cart for PromotionsEngine (D-01)',
  })
  @RequirePermission('cart:update')
  setCartCoupon(
    @Args('input', { type: () => SetCartCouponInput })
    input: SetCartCouponInput,
  ): Promise<CartType> {
    return this.cartService.setCoupon(input);
  }
}
