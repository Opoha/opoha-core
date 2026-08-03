import {
  Field,
  ID,
  InputType,
  ObjectType,
} from '@nestjs/graphql';

@ObjectType('Store', {
  description: 'Application-level store / brand (multi-store scoping)',
})
export class StoreType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => Boolean)
  isDefault!: boolean;

  @Field(() => String, {
    description: 'Default currency pointer (ISO 4217)',
  })
  defaultCurrencyCode!: string;

  @Field(() => String, {
    description: 'Default locale pointer (BCP 47-like, e.g. en-US)',
  })
  defaultLocale!: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class CreateStoreInput {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => Boolean, { nullable: true })
  isDefault?: boolean;

  @Field(() => String, {
    description: 'Default currency pointer (ISO 4217)',
  })
  defaultCurrencyCode!: string;

  @Field(() => String, {
    description: 'Default locale pointer (BCP 47-like, e.g. en-US)',
  })
  defaultLocale!: string;
}

@InputType()
export class UpdateStoreInput {
  @Field(() => String, { nullable: true })
  code?: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => Boolean, { nullable: true })
  isDefault?: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'Default currency pointer (ISO 4217)',
  })
  defaultCurrencyCode?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Default locale pointer (BCP 47-like, e.g. en-US)',
  })
  defaultLocale?: string;
}
