import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType('GiftCard', { description: 'A purchasable/redeemable gift card' })
export class GiftCardType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  currencyCode!: string;

  @Field(() => String, {
    description: 'Original issued balance in minor units',
  })
  initialBalanceMinor!: string;

  @Field(() => String, {
    description: 'Current remaining balance in minor units',
  })
  balanceMinor!: string;

  @Field(() => String, {
    description: 'active | redeemed | disabled | expired',
  })
  status!: string;

  @Field(() => ID, { nullable: true })
  issuedToCustomerId!: string | null;

  @Field(() => ID, { nullable: true })
  purchasedByCustomerId!: string | null;

  @Field(() => ID, { nullable: true })
  purchaseOrderId!: string | null;

  @Field(() => Date, { nullable: true })
  expiresAt!: Date | null;

  @Field(() => String, { nullable: true })
  note!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('GiftCardTransaction', {
  description: 'Append-only gift card balance ledger entry',
})
export class GiftCardLedgerEntryType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  giftCardId!: string;

  @Field(() => String, {
    description: 'issue | purchase | redeem | adjust',
  })
  type!: string;

  @Field(() => String)
  amountMinor!: string;

  @Field(() => String)
  balanceAfterMinor!: string;

  @Field(() => ID, { nullable: true })
  orderId!: string | null;

  @Field(() => String, { nullable: true })
  note!: string | null;

  @Field(() => Date)
  createdAt!: Date;
}

@InputType({ description: 'Staff/admin issue of a new gift card' })
export class IssueGiftCardInput {
  @Field(() => String)
  currencyCode!: string;

  @Field(() => String, { description: 'Initial balance in minor units' })
  amountMinor!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Explicit code; generated when omitted',
  })
  code?: string;

  @Field(() => ID, { nullable: true })
  customerId?: string | null;

  @Field(() => Date, { nullable: true })
  expiresAt?: Date | null;

  @Field(() => String, { nullable: true })
  note?: string;
}

@InputType({ description: 'Customer self-purchase of a gift card on an order' })
export class PurchaseGiftCardInput {
  @Field(() => ID)
  orderId!: string;

  @Field(() => String)
  currencyCode!: string;

  @Field(() => String, { description: 'Card balance in minor units' })
  amountMinor!: string;

  @Field(() => String, { nullable: true })
  code?: string;

  @Field(() => ID, { nullable: true })
  customerId?: string | null;

  @Field(() => Date, { nullable: true })
  expiresAt?: Date | null;

  @Field(() => String, { nullable: true })
  note?: string;
}

@InputType({ description: 'Redeem a gift card against an order (checkout)' })
export class RedeemGiftCardInput {
  @Field(() => String)
  code!: string;

  @Field(() => String, { description: 'Amount to redeem in minor units' })
  amountMinor!: string;

  @Field(() => ID, { nullable: true })
  orderId?: string | null;

  @Field(() => String, { nullable: true })
  note?: string;
}

@InputType({
  description: 'Quote how much of a gift card can apply toward a total',
})
export class QuoteGiftCardRedeemInput {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  currencyCode!: string;

  @Field(() => String, {
    description: 'Max amount that may be applied (usually remaining total)',
  })
  maxAmountMinor!: string;
}

@ObjectType('QuoteGiftCardRedeemResult', {
  description: 'Non-mutating preview of a gift card redemption',
})
export class QuoteGiftCardRedeemResult {
  @Field(() => ID)
  giftCardId!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  currencyCode!: string;

  @Field(() => String)
  availableMinor!: string;

  @Field(() => String)
  appliedMinor!: string;
}
