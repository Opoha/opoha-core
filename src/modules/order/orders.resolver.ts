import { UseGuards } from '@nestjs/common';
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import {
  ApproveB2bOrderInput,
  ConfirmB2bOrderInput,
  ConvertB2bQuoteInput,
} from '../b2b/public';
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

  @Mutation(() => OrderType, {
    name: 'approveB2bOrder',
    description: 'Approve a B2B draft order (draft → approved) (F-03 / F-06)',
  })
  @RequirePermission('b2b:approve')
  approveB2bOrder(
    @Args('input', { type: () => ApproveB2bOrderInput })
    input: ApproveB2bOrderInput,
  ): Promise<OrderType> {
    return this.ordersService.approveB2bOrder(input);
  }

  @Mutation(() => OrderType, {
    name: 'confirmB2bOrder',
    description:
      'Confirm an approved B2B order with payment (approved → confirmed) (F-03 / F-06)',
  })
  @RequirePermission('b2b:approve')
  confirmB2bOrder(
    @Args('input', { type: () => ConfirmB2bOrderInput })
    input: ConfirmB2bOrderInput,
  ): Promise<OrderType> {
    return this.ordersService.confirmB2bOrder(input);
  }

  @Mutation(() => OrderType, {
    name: 'convertB2bQuote',
    description:
      'Convert an accepted B2B quote to a draft company order (F-05 foundation)',
  })
  @RequirePermission('b2b:convert')
  convertB2bQuote(
    @Args('input', { type: () => ConvertB2bQuoteInput })
    input: ConvertB2bQuoteInput,
  ): Promise<OrderType> {
    return this.ordersService.convertB2bQuote(input);
  }
}
