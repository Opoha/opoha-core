import { UseGuards } from '@nestjs/common';
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import type { StoreContextRef } from '../stores/public';
import { OrdersService } from './orders.service';
import {
  OrderType,
  PlaceOrderInput,
  UpdateOrderStatusInput,
} from './order.types';

type GqlStoreContext = {
  storeContext?: StoreContextRef;
};

@Resolver(() => OrderType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class OrdersResolver {
  constructor(private readonly ordersService: OrdersService) {}

  @Query(() => [OrderType], {
    name: 'orders',
    description:
      'List orders. Optional storeId filters to that store channel.',
  })
  @RequirePermission('order:read')
  orders(
    @Args('storeId', { type: () => ID, nullable: true }) storeId?: string,
  ): Promise<OrderType[]> {
    return this.ordersService.findAll(storeId);
  }

  @Query(() => OrderType, {
    name: 'order',
    description: 'Get order by id',
  })
  @RequirePermission('order:read')
  order(@Args('id', { type: () => ID }) id: string): Promise<OrderType> {
    return this.ordersService.findById(id);
  }

  @Mutation(() => OrderType, {
    name: 'placeOrder',
    description:
      'Place order from a locked cart through PaymentEngine; copies storeId and validates store context (B-02)',
  })
  @RequirePermission('order:create')
  placeOrder(
    @Args('input') input: PlaceOrderInput,
    @Context() ctx: GqlStoreContext,
  ): Promise<OrderType> {
    return this.ordersService.placeOrder(input, ctx.storeContext);
  }

  @Mutation(() => OrderType, {
    name: 'updateOrderStatus',
    description: 'Transition order status along the allowed state machine',
  })
  @RequirePermission('order:update')
  updateOrderStatus(
    @Args('input') input: UpdateOrderStatusInput,
  ): Promise<OrderType> {
    return this.ordersService.updateStatus(input);
  }
}
