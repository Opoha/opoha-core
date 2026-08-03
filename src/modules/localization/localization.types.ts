import { Field, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType({
  description:
    'Single-country deployment localization settings (Phase 1 foundation)',
})
export class LocalizationSettingsType {
  @Field(() => String, { description: 'ISO 3166-1 alpha-2 country code' })
  countryCode!: string;

  @Field(() => String, { description: 'ISO 4217 currency code' })
  currencyCode!: string;

  @Field(() => String, { description: 'IANA timezone identifier' })
  timezone!: string;

  @Field(() => String, {
    description: 'Default BCP 47 locale (language foundation)',
  })
  defaultLocale!: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class UpdateLocalizationSettingsInput {
  @Field(() => String, {
    nullable: true,
    description: 'ISO 3166-1 alpha-2 country code',
  })
  countryCode?: string;

  @Field(() => String, {
    nullable: true,
    description: 'ISO 4217 currency code',
  })
  currencyCode?: string;

  @Field(() => String, {
    nullable: true,
    description: 'IANA timezone identifier',
  })
  timezone?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Default BCP 47 locale',
  })
  defaultLocale?: string;
}
