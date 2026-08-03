import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { OrdersService } from './orders.service';
import {
  OrderType,
  PlaceOrderInput,
  UpdateOrderStatusInput,
} from './order.types';

@Resolver(() => OrderType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class OrdersResolver {
  constructor(private readonly ordersService: OrdersService) {}

  @Query(() => [OrderType], {
    name: 'orders',
    description: 'List orders',
  })
  @RequirePermission('order:read')
  orders(): Promise<OrderType[]> {
    return this.ordersService.findAll();
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
      'Place order from a locked cart through PaymentEngine (authorize; zero also captures)',
  })
  @RequirePermission('order:create')
  placeOrder(
    @Args('input') input: PlaceOrderInput,
  ): Promise<OrderType> {
    return this.ordersService.placeOrder(input);
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
