import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard, PermissionsGuard, RequirePermission } from '../auth/public';
import { LoyaltyService } from './loyalty.service';
import {
  AccrueLoyaltyInput,
  LoyaltyAccountType,
  LoyaltyLedgerEntryType,
  QuoteLoyaltyRedeemInput,
  QuoteLoyaltyRedeemResult,
  RedeemLoyaltyInput,
} from './loyalty.types';

@Resolver(() => LoyaltyAccountType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class LoyaltyResolver {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Query(() => LoyaltyAccountType, {
    name: 'loyaltyAccount',
    nullable: true,
    description: 'Get a customer loyalty account (null when never accrued)',
  })
  @RequirePermission('loyalty:read')
  loyaltyAccount(
    @Args('customerId', { type: () => ID }) customerId: string,
  ): Promise<LoyaltyAccountType | null> {
    return this.loyalty.findByCustomerId(customerId);
  }

  @Query(() => [LoyaltyLedgerEntryType], {
    name: 'loyaltyTransactions',
    description: 'List loyalty ledger transactions for a customer',
  })
  @RequirePermission('loyalty:read')
  loyaltyTransactions(
    @Args('customerId', { type: () => ID }) customerId: string,
  ): Promise<LoyaltyLedgerEntryType[]> {
    return this.loyalty.listTransactions(customerId);
  }

  @Query(() => QuoteLoyaltyRedeemResult, {
    name: 'quoteLoyaltyRedeem',
    description: 'Preview how many loyalty points can apply toward a total (no mutation)',
  })
  @RequirePermission('loyalty:read')
  quoteLoyaltyRedeem(
    @Args('input', { type: () => QuoteLoyaltyRedeemInput })
    input: QuoteLoyaltyRedeemInput,
  ): Promise<QuoteLoyaltyRedeemResult> {
    return this.loyalty.quoteRedeem(input);
  }

  @Mutation(() => LoyaltyAccountType, {
    name: 'accrueLoyaltyPoints',
    description: 'Staff/admin manual loyalty points accrual (publishes LoyaltyPointsAccrued)',
  })
  @RequirePermission('loyalty:accrue')
  accrueLoyaltyPoints(
    @Args('input', { type: () => AccrueLoyaltyInput })
    input: AccrueLoyaltyInput,
  ): Promise<LoyaltyAccountType> {
    return this.loyalty.accrue(input);
  }

  @Mutation(() => LoyaltyAccountType, {
    name: 'redeemLoyaltyPoints',
    description: 'Redeem loyalty points against an order (publishes LoyaltyPointsRedeemed)',
  })
  @RequirePermission('loyalty:redeem')
  redeemLoyaltyPoints(
    @Args('input', { type: () => RedeemLoyaltyInput })
    input: RedeemLoyaltyInput,
  ): Promise<LoyaltyAccountType> {
    return this.loyalty.redeem(input);
  }
}
