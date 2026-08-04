import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { SubscriptionService } from './subscription.service';
import {
  CreateSubscriptionPlanInput,
  SubscribeToPlanInput,
  SubscriptionPlanType,
  SubscriptionRenewalResultType,
  SubscriptionType,
} from './subscription.types';

@Resolver()
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class SubscriptionResolver {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Query(() => [SubscriptionPlanType], {
    name: 'subscriptionPlans',
    description: 'List recurring billing plans',
  })
  @RequirePermission('subscription:read')
  subscriptionPlans(
    @Args('activeOnly', { type: () => Boolean, nullable: true })
    activeOnly?: boolean,
  ): Promise<SubscriptionPlanType[]> {
    return this.subscriptionService.listPlans(activeOnly);
  }

  @Query(() => SubscriptionPlanType, {
    name: 'subscriptionPlan',
    description: 'Get a subscription plan by id',
  })
  @RequirePermission('subscription:read')
  subscriptionPlan(@Args('id', { type: () => ID }) id: string): Promise<SubscriptionPlanType> {
    return this.subscriptionService.findPlanById(id);
  }

  @Query(() => SubscriptionType, {
    name: 'subscription',
    description: 'Get a subscription by id',
  })
  @RequirePermission('subscription:read')
  subscription(@Args('id', { type: () => ID }) id: string): Promise<SubscriptionType> {
    return this.subscriptionService.findById(id);
  }

  @Query(() => [SubscriptionType], {
    name: 'subscriptionsForCustomer',
    description: 'List subscriptions for a customer',
  })
  @RequirePermission('subscription:read')
  subscriptionsForCustomer(
    @Args('customerId', { type: () => ID }) customerId: string,
  ): Promise<SubscriptionType[]> {
    return this.subscriptionService.listForCustomer(customerId);
  }

  @Mutation(() => SubscriptionPlanType, {
    name: 'createSubscriptionPlan',
    description: 'Create a recurring billing plan',
  })
  @RequirePermission('subscription:manage')
  createSubscriptionPlan(
    @Args('input', { type: () => CreateSubscriptionPlanInput })
    input: CreateSubscriptionPlanInput,
  ): Promise<SubscriptionPlanType> {
    return this.subscriptionService.createPlan(input);
  }

  @Mutation(() => SubscriptionType, {
    name: 'subscribeToPlan',
    description: 'Subscribe a customer to a recurring billing plan',
  })
  @RequirePermission('subscription:create')
  subscribeToPlan(
    @Args('input', { type: () => SubscribeToPlanInput })
    input: SubscribeToPlanInput,
  ): Promise<SubscriptionType> {
    return this.subscriptionService.subscribe(input);
  }

  @Mutation(() => SubscriptionType, {
    name: 'cancelSubscription',
    description: 'Cancel a subscription',
  })
  @RequirePermission('subscription:manage')
  cancelSubscription(@Args('id', { type: () => ID }) id: string): Promise<SubscriptionType> {
    return this.subscriptionService.cancel(id);
  }

  @Mutation(() => SubscriptionRenewalResultType, {
    name: 'renewSubscription',
    description:
 'Charge a subscription for its current period via the payment engine (renewal job/path stub)',
  })
  @RequirePermission('subscription:manage')
  async renewSubscription(
    @Args('id', { type: () => ID }) id: string,
    @Args('orderId', { type: () => ID, nullable: true })
    orderId?: string | null,
  ): Promise<SubscriptionRenewalResultType> {
    const result = await this.subscriptionService.renew(id, {
      orderId: orderId ?? undefined,
    });
    return {
      subscription: result.subscription,
      paymentId: result.paymentId,
      paymentStatus: result.paymentStatus,
    };
  }
}
