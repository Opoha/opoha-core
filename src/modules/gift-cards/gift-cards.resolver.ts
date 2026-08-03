import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import {
  GqlAuthGuard,
  PermissionsGuard,
  RequirePermission,
} from '../auth/public';
import { GiftCardService } from './gift-cards.service';
import {
  GiftCardLedgerEntryType,
  GiftCardType,
  IssueGiftCardInput,
  PurchaseGiftCardInput,
  QuoteGiftCardRedeemInput,
  QuoteGiftCardRedeemResult,
  RedeemGiftCardInput,
} from './gift-cards.types';

@Resolver(() => GiftCardType)
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class GiftCardsResolver {
  constructor(private readonly giftCards: GiftCardService) {}

  @Query(() => GiftCardType, {
    name: 'giftCard',
    description: 'Get a gift card by id',
  })
  @RequirePermission('giftcard:read')
  giftCard(@Args('id', { type: () => ID }) id: string): Promise<GiftCardType> {
    return this.giftCards.findById(id);
  }

  @Query(() => GiftCardType, {
    name: 'giftCardByCode',
    description: 'Get a gift card by code',
  })
  @RequirePermission('giftcard:read')
  giftCardByCode(
    @Args('code', { type: () => String }) code: string,
  ): Promise<GiftCardType> {
    return this.giftCards.findByCode(code);
  }

  @Query(() => [GiftCardLedgerEntryType], {
    name: 'giftCardTransactions',
    description: 'List ledger transactions for a gift card',
  })
  @RequirePermission('giftcard:read')
  giftCardTransactions(
    @Args('giftCardId', { type: () => ID }) giftCardId: string,
  ): Promise<GiftCardLedgerEntryType[]> {
    return this.giftCards.listTransactions(giftCardId);
  }

  @Query(() => QuoteGiftCardRedeemResult, {
    name: 'quoteGiftCardRedeem',
    description:
      'Preview how much of a gift card can apply toward a total (no mutation)',
  })
  @RequirePermission('giftcard:read')
  quoteGiftCardRedeem(
    @Args('input', { type: () => QuoteGiftCardRedeemInput })
    input: QuoteGiftCardRedeemInput,
  ): Promise<QuoteGiftCardRedeemResult> {
    return this.giftCards.quoteRedeem(input);
  }

  @Mutation(() => GiftCardType, {
    name: 'issueGiftCard',
    description: 'Staff/admin issue of a new gift card with an initial balance',
  })
  @RequirePermission('giftcard:issue')
  issueGiftCard(
    @Args('input', { type: () => IssueGiftCardInput })
    input: IssueGiftCardInput,
  ): Promise<GiftCardType> {
    return this.giftCards.issue(input);
  }

  @Mutation(() => GiftCardType, {
    name: 'purchaseGiftCard',
    description: 'Customer self-purchase of a gift card linked to a paid order',
  })
  @RequirePermission('giftcard:purchase')
  purchaseGiftCard(
    @Args('input', { type: () => PurchaseGiftCardInput })
    input: PurchaseGiftCardInput,
  ): Promise<GiftCardType> {
    return this.giftCards.purchase(input);
  }

  @Mutation(() => GiftCardType, {
    name: 'redeemGiftCard',
    description:
      'Redeem a gift card balance against an order (publishes GiftCardRedeemed)',
  })
  @RequirePermission('giftcard:redeem')
  redeemGiftCard(
    @Args('input', { type: () => RedeemGiftCardInput })
    input: RedeemGiftCardInput,
  ): Promise<GiftCardType> {
    return this.giftCards.redeem(input);
  }
}
