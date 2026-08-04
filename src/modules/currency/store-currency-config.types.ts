import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType('StoreCurrencyConfig', {
 description: 'Store-scoped display vs settlement currency configuration',
})
export class StoreCurrencyConfigType {
  @Field(() => ID, { description: 'Store channel id' })
  storeId!: string;

  @Field(() => String, {
    description: 'ISO 4217 settlement / capture currency',
  })
  settlementCurrencyCode!: string;

  @Field(() => String, {
    description: 'Primary ISO 4217 customer-facing display currency',
  })
  displayCurrencyCode!: string;

  @Field(() => [String], {
    description: 'Additional allowed display currencies (primary display always enabled)',
  })
  enabledDisplayCurrencies!: string[];

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class UpdateStoreCurrencyConfigInput {
  @Field(() => String, {
    nullable: true,
    description: 'ISO 4217 settlement / capture currency',
  })
  settlementCurrencyCode?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Primary ISO 4217 customer-facing display currency',
  })
  displayCurrencyCode?: string;

  @Field(() => [String], {
    nullable: true,
    description: 'Replace additional allowed display currencies (ISO 4217 codes)',
  })
  enabledDisplayCurrencies?: string[];
}
