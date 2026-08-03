import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType('ExchangeRate', {
  description:
    'FX rate: 1 fromCurrencyCode = rate × toCurrencyCode (Phase 5 D-02)',
})
export class ExchangeRateType {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { description: 'ISO 4217 source currency' })
  fromCurrencyCode!: string;

  @Field(() => String, { description: 'ISO 4217 target currency' })
  toCurrencyCode!: string;

  @Field(() => Float, {
    description: 'Multiply from-amount by this rate to get to-amount',
  })
  rate!: number;

  @Field(() => String, {
    description: 'Rate provenance (manual | provider id)',
  })
  source!: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class CreateExchangeRateInput {
  @Field(() => String, { description: 'ISO 4217 source currency' })
  fromCurrencyCode!: string;

  @Field(() => String, { description: 'ISO 4217 target currency' })
  toCurrencyCode!: string;

  @Field(() => Float, {
    description: 'Multiply from-amount by this rate to get to-amount (> 0)',
  })
  rate!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Rate provenance (default: manual)',
  })
  source?: string;
}

@InputType()
export class UpdateExchangeRateInput {
  @Field(() => Float, {
    nullable: true,
    description: 'Multiply from-amount by this rate to get to-amount (> 0)',
  })
  rate?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Rate provenance (manual | provider id)',
  })
  source?: string;
}
