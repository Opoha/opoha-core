import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { FulfillmentService } from './fulfillment.service';
import {
  CreateFulfillmentInput,
  FulfillmentType,
  PackFulfillmentInput,
  ShipFulfillmentInput,
} from './fulfillment.types';

@Resolver(() => FulfillmentType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class FulfillmentResolver {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  @Query(() => [FulfillmentType], {
    name: 'fulfillments',
    description: 'List fulfillments (optionally filtered by status)',
  })
  @RequirePermission('fulfillment:read')
  fulfillments(
    @Args('status', { type: () => String, nullable: true })
    status?: string,
  ): Promise<FulfillmentType[]> {
    return this.fulfillmentService.findAll(
      status as
        | 'pending'
        | 'picked'
        | 'packed'
        | 'shipped'
        | 'cancelled'
        | undefined,
    );
  }

  @Query(() => FulfillmentType, {
    name: 'fulfillment',
    description: 'Get a fulfillment by id',
  })
  @RequirePermission('fulfillment:read')
  fulfillment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<FulfillmentType> {
    return this.fulfillmentService.findById(id);
  }

  @Query(() => [FulfillmentType], {
    name: 'fulfillmentsByOrder',
    description: 'List fulfillments for an order',
  })
  @RequirePermission('fulfillment:read')
  fulfillmentsByOrder(
    @Args('orderId', { type: () => ID }) orderId: string,
  ): Promise<FulfillmentType[]> {
    return this.fulfillmentService.findByOrderId(orderId);
  }

  @Mutation(() => FulfillmentType, {
    name: 'createFulfillment',
    description: 'Create a pending fulfillment for order line quantities',
  })
  @RequirePermission('fulfillment:create')
  createFulfillment(
    @Args('input', { type: () => CreateFulfillmentInput })
    input: CreateFulfillmentInput,
  ): Promise<FulfillmentType> {
    return this.fulfillmentService.create(input);
  }

  @Mutation(() => FulfillmentType, {
    name: 'pickFulfillment',
    description: 'Mark a pending fulfillment as picked',
  })
  @RequirePermission('fulfillment:pick')
  pickFulfillment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<FulfillmentType> {
    return this.fulfillmentService.pick(id);
  }

  @Mutation(() => FulfillmentType, {
    name: 'packFulfillment',
    description: 'Mark a picked fulfillment as packed (optional packages)',
  })
  @RequirePermission('fulfillment:pack')
  packFulfillment(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => PackFulfillmentInput, nullable: true })
    input?: PackFulfillmentInput,
  ): Promise<FulfillmentType> {
    return this.fulfillmentService.pack(id, input ?? {});
  }

  @Mutation(() => FulfillmentType, {
    name: 'shipFulfillment',
    description:
      'Ship a packed fulfillment; may call ShippingMethodProvider.createLabel',
  })
  @RequirePermission('fulfillment:ship')
  shipFulfillment(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => ShipFulfillmentInput, nullable: true })
    input?: ShipFulfillmentInput,
  ): Promise<FulfillmentType> {
    return this.fulfillmentService.ship(id, input ?? {});
  }

  @Mutation(() => FulfillmentType, {
    name: 'cancelFulfillment',
    description: 'Cancel a pending or picked fulfillment',
  })
  @RequirePermission('fulfillment:cancel')
  cancelFulfillment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<FulfillmentType> {
    return this.fulfillmentService.cancel(id);
  }
}
