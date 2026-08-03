import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  ObjectType,
} from '@nestjs/graphql';

@ObjectType('Payment', { description: 'Persisted payment record' })
export class PaymentType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  orderId!: string;

  @Field(() => String)
  providerCode!: string;

  @Field(() => String)
  status!: string;

  @Field(() => String)
  amountMinor!: string;

  @Field(() => String)
  currencyCode!: string;

  @Field(() => String, { nullable: true })
  externalId!: string | null;

  @Field(() => String, { nullable: true })
  idempotencyKey!: string | null;

  /** JSON-encoded metadata (no secrets). */
  @Field(() => String, { nullable: true })
  metadataJson!: string | null;

  @Field(() => String, { nullable: true })
  errorMessage!: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  authorizedAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  capturedAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  refundedAt!: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  failedAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType('PaymentProvider', {
  description: 'Registered payment provider available for use',
})
export class PaymentProviderType {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  displayName!: string;
}

@InputType({ description: 'Minor-unit money amount (bigint as decimal string)' })
export class MoneyAmountInput {
  @Field(() => String)
  amountMinor!: string;

  @Field(() => String)
  currencyCode!: string;
}

@InputType({ description: 'Authorize a new payment against an order' })
export class AuthorizePaymentInput {
  @Field(() => String, {
    description: 'Payment provider code (e.g. "manual")',
  })
  providerCode!: string;

  @Field(() => ID)
  orderId!: string;

  @Field(() => MoneyAmountInput)
  amount!: MoneyAmountInput;

  @Field(() => String, { nullable: true })
  idempotencyKey?: string;

  /** JSON-encoded metadata, parsed and forwarded as-is. */
  @Field(() => String, { nullable: true })
  metadataJson?: string;
}

@InputType({ description: 'Capture a previously authorized (or pending) payment' })
export class CapturePaymentInput {
  @Field(() => ID)
  paymentId!: string;

  @Field(() => MoneyAmountInput, { nullable: true })
  amount?: MoneyAmountInput;

  @Field(() => String, { nullable: true })
  idempotencyKey?: string;
}

@InputType({ description: 'Refund a captured payment (full or partial amount)' })
export class RefundPaymentInput {
  @Field(() => ID)
  paymentId!: string;

  @Field(() => MoneyAmountInput, { nullable: true })
  amount?: MoneyAmountInput;

  @Field(() => String, { nullable: true })
  idempotencyKey?: string;
}
