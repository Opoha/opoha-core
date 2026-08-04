import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('SubscriptionPlan', {
 description: 'Recurring billing plan',
})
export class SubscriptionPlanType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => String, { description: 'Minor-unit price (decimal string)' })
  priceMinor!: string;

  @Field(() => String)
  currencyCode!: string;

  @Field(() => String, { description: 'day | week | month | year' })
  billingIntervalUnit!: string;

  @Field(() => Int)
  billingIntervalCount!: number;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('Subscription', {
 description: 'Customer subscription schedule state',
})
export class SubscriptionType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  planId!: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => ID, { nullable: true })
  storeId!: string | null;

  @Field(() => String, {
    description: 'active | paused | canceled | past_due | expired',
  })
  status!: string;

  @Field(() => String)
  paymentProviderCode!: string;

  @Field(() => Date)
  currentPeriodStart!: Date;

  @Field(() => Date)
  currentPeriodEnd!: Date;

  @Field(() => Date)
  nextBillingAt!: Date;

  @Field(() => Date, { nullable: true })
  canceledAt!: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType('SubscriptionRenewalResult', {
  description: 'Result of charging a subscription for its next billing period',
})
export class SubscriptionRenewalResultType {
  @Field(() => SubscriptionType)
  subscription!: SubscriptionType;

  @Field(() => ID)
  paymentId!: string;

  @Field(() => String)
  paymentStatus!: string;
}

@InputType()
export class CreateSubscriptionPlanInput {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String)
  priceMinor!: string;

  @Field(() => String, { nullable: true, defaultValue: 'USD' })
  currencyCode?: string;

  @Field(() => String, { nullable: true, defaultValue: 'month' })
  billingIntervalUnit?: string;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  billingIntervalCount?: number;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;
}

@InputType()
export class SubscribeToPlanInput {
  @Field(() => ID)
  planId!: string;

  @Field(() => ID)
  customerId!: string;

  @Field(() => ID, { nullable: true })
  storeId?: string | null;

  @Field(() => String, { nullable: true, defaultValue: 'manual' })
  paymentProviderCode?: string;
}
