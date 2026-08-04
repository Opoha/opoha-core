import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

/**
 * Catalog translation GraphQL + service DTOs.
 * Base product/category row = default locale; translation rows hold overlays.
 */

@ObjectType({ description: 'Locale overlay for a catalog product' })
export class ProductTranslationType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  productId!: string;

  @Field(() => String, { description: 'BCP 47 locale (e.g. th-TH)' })
  locale!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  slug!: string | null;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@ObjectType({ description: 'Locale overlay for a catalog category' })
export class CategoryTranslationType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  categoryId!: string;

  @Field(() => String, { description: 'BCP 47 locale (e.g. th-TH)' })
  locale!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  slug!: string | null;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class UpsertProductTranslationInput {
  @Field(() => ID)
  productId!: string;

  @Field(() => String, { description: 'BCP 47 locale (e.g. th-TH)' })
  locale!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  slug?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;
}

@InputType()
export class UpsertCategoryTranslationInput {
  @Field(() => ID)
  categoryId!: string;

  @Field(() => String, { description: 'BCP 47 locale (e.g. th-TH)' })
  locale!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  slug?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;
}

/** Service record aliases (same shape as GraphQL types). */
export type ProductTranslationRecord = ProductTranslationType;
export type CategoryTranslationRecord = CategoryTranslationType;

export type CatalogTranslationFields = {
  name: string;
  slug: string | null;
  description: string | null;
};
