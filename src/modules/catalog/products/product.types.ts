import { Field, Float, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Sellable product (catalog aggregate)' })
export class ProductType {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Boolean)
  isActive!: boolean;

  /**
   * Owning store id. Null = shared catalog (visible to all stores).
   * Set = store-owned / isolated.
   */
  @Field(() => ID, { nullable: true })
  storeId!: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => [ProductVariantType], { nullable: 'itemsAndList' })
  variants?: ProductVariantType[];

  /**
   * Populated by a field resolver hook (Phase 4 D-04) — null when no review
   * plugin is installed/enabled. Never a DB column on this type.
   */
  @Field(() => ProductReviewAggregateType, { nullable: true })
  reviewAggregate?: ProductReviewAggregateType | null;
}

@ObjectType({
  description:
    'Rating aggregate for a product, contributed by an optional review plugin (Phase 4 D-04)',
})
export class ProductReviewAggregateType {
  @Field(() => Float)
  averageRating!: number;

  @Field(() => Int)
  reviewCount!: number;
}

@ObjectType({ description: 'Product SKU / purchasable variant' })
export class ProductVariantType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  productId!: string;

  @Field(() => String)
  sku!: string;

  @Field(() => String, { nullable: true })
  name!: string | null;

  /** Price in minor currency units (e.g. cents). */
  @Field(() => String)
  priceMinor!: string;

  @Field(() => String)
  currencyCode!: string;

  @Field(() => Boolean)
  isActive!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class CreateProductVariantInput {
  @Field(() => String)
  sku!: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, {
    description: 'Price in minor units as decimal string (e.g. "1999")',
  })
  priceMinor!: string;

  @Field(() => String, { nullable: true, defaultValue: 'USD' })
  currencyCode?: string;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  isActive?: boolean;
}

@InputType()
export class CreateProductInput {
  @Field(() => String)
  name!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  isActive?: boolean;

  /**
   * Omit / null = shared catalog. Set to a store id for store-owned product.
   */
  @Field(() => ID, { nullable: true })
  storeId?: string | null;

  @Field(() => [CreateProductVariantInput], { nullable: true })
  variants?: CreateProductVariantInput[];
}

@InputType()
export class UpdateProductInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  slug?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  /**
   * Set to reassign ownership. Pass null to make shared.
   */
  @Field(() => ID, { nullable: true })
  storeId?: string | null;
}
