import { UseGuards } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { OrdersService } from './orders.service';
import { OrderType } from './order.types';

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
}
