import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';

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

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => [ProductVariantType], { nullable: 'itemsAndList' })
  variants?: ProductVariantType[];
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
}
