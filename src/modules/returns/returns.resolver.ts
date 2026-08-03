import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { ReturnsService } from './returns.service';
import {
  CompleteRefundInput,
  CreateReturnInput,
  ReturnType,
} from './returns.types';

@Resolver(() => ReturnType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class ReturnsResolver {
  constructor(private readonly returnsService: ReturnsService) {}

  @Query(() => [ReturnType], {
    name: 'returns',
    description: 'List returns / RMAs (optionally filtered by status)',
  })
  @RequirePermission('return:read')
  returns(
    @Args('status', { type: () => String, nullable: true })
    status?: string,
  ): Promise<ReturnType[]> {
    return this.returnsService.findAll(
      status as
        | 'requested'
        | 'approved'
        | 'received'
        | 'refunded'
        | 'exchanged'
        | 'cancelled'
        | undefined,
    );
  }

  @Query(() => ReturnType, {
    name: 'return',
    description: 'Get a return / RMA by id',
  })
  @RequirePermission('return:read')
  returnById(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ReturnType> {
    return this.returnsService.findById(id);
  }

  @Query(() => [ReturnType], {
    name: 'returnsByOrder',
    description: 'List returns / RMAs for an order',
  })
  @RequirePermission('return:read')
  returnsByOrder(
    @Args('orderId', { type: () => ID }) orderId: string,
  ): Promise<ReturnType[]> {
    return this.returnsService.findByOrderId(orderId);
  }

  @Mutation(() => ReturnType, {
    name: 'createReturn',
    description: 'Create a requested RMA for confirmed/fulfilled order lines',
  })
  @RequirePermission('return:create')
  createReturn(
    @Args('input', { type: () => CreateReturnInput })
    input: CreateReturnInput,
  ): Promise<ReturnType> {
    return this.returnsService.create(input);
  }

  @Mutation(() => ReturnType, {
    name: 'approveReturn',
    description: 'Approve a requested RMA',
  })
  @RequirePermission('return:approve')
  approveReturn(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ReturnType> {
    return this.returnsService.approve(id);
  }

  @Mutation(() => ReturnType, {
    name: 'receiveReturn',
    description: 'Mark an approved RMA received and restock into its warehouse',
  })
  @RequirePermission('return:receive')
  receiveReturn(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ReturnType> {
    return this.returnsService.receive(id);
  }

  @Mutation(() => ReturnType, {
    name: 'completeReturnRefund',
    description:
      'Complete a refund-resolution RMA via PaymentEngine (publishes RefundCompleted)',
  })
  @RequirePermission('return:refund')
  completeReturnRefund(
    @Args('input', { type: () => CompleteRefundInput })
    input: CompleteRefundInput,
  ): Promise<ReturnType> {
    return this.returnsService.completeRefund(input);
  }

  @Mutation(() => ReturnType, {
    name: 'completeReturnExchange',
    description:
      'Complete an exchange-resolution RMA (creates a pending replacement order stub)',
  })
  @RequirePermission('return:exchange')
  completeReturnExchange(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ReturnType> {
    return this.returnsService.completeExchange(id);
  }

  @Mutation(() => ReturnType, {
    name: 'cancelReturn',
    description: 'Cancel a requested or approved RMA',
  })
  @RequirePermission('return:cancel')
  cancelReturn(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ReturnType> {
    return this.returnsService.cancel(id);
  }
}
