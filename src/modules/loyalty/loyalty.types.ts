import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('LoyaltyAccount', {
  description: 'Customer loyalty points balance',
})
export class LoyaltyAccountType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => Int)
  pointsBalance!: number;

  @Field(() => Int)
  lifetimePointsEarned!: number;

  @Field(() => Int)
  lifetimePointsRedeemed!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('LoyaltyTransaction', {
  description: 'Append-only loyalty points ledger entry',
})
export class LoyaltyLedgerEntryType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  accountId!: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => String, { description: 'accrue | redeem | adjust' })
  type!: string;

  @Field(() => Int)
  points!: number;

  @Field(() => Int)
  balanceAfter!: number;

  @Field(() => ID, { nullable: true })
  orderId!: string | null;

  @Field(() => String, { nullable: true })
  note!: string | null;

  @Field(() => Date)
  createdAt!: Date;
}

@InputType({ description: 'Staff/admin manual loyalty points accrual' })
export class AccrueLoyaltyInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => Int)
  points!: number;

  @Field(() => ID, { nullable: true })
  orderId?: string;

  @Field(() => String, { nullable: true })
  note?: string;
}

@InputType({ description: 'Redeem loyalty points against an order (checkout)' })
export class RedeemLoyaltyInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => Int)
  points!: number;

  @Field(() => ID, { nullable: true })
  orderId?: string;

  @Field(() => String, { nullable: true })
  note?: string;
}

@InputType({
  description: 'Quote how many loyalty points can apply toward a total',
})
export class QuoteLoyaltyRedeemInput {
  @Field(() => ID)
  customerId!: string;

  @Field(() => Int, {
    description: 'Requested points to redeem; capped by balance and maxAmountMinor',
  })
  points!: number;

  @Field(() => String, {
    description: 'Remaining payable total in minor units (post gift-card)',
  })
  maxAmountMinor!: string;
}

@ObjectType('QuoteLoyaltyRedeemResult', {
  description: 'Non-mutating preview of a loyalty points redemption',
})
export class QuoteLoyaltyRedeemResult {
  @Field(() => ID)
  customerId!: string;

  @Field(() => Int)
  availablePoints!: number;

  @Field(() => Int)
  pointsToRedeem!: number;

  @Field(() => String)
  appliedMinor!: string;
}
