import { AttributeDefinitionEntity } from './attribute-definition.entity';
import { AttributeValueEntity } from './attribute-value.entity';
import { BrandEntity } from './brand.entity';
import { CategoryEntity } from './category.entity';
import { CategoryTranslationEntity } from './category-translation.entity';
import { CollectionEntity } from './collection.entity';
import { ProductMediaEntity } from './product-media.entity';
import { ProductVariantEntity } from './product-variant.entity';
import { ProductEntity } from './product.entity';
import { ProductTranslationEntity } from './product-translation.entity';

export const catalogEntities = [
  ProductEntity,
  ProductVariantEntity,
  ProductTranslationEntity,
  CategoryEntity,
  CategoryTranslationEntity,
  CollectionEntity,
  BrandEntity,
  AttributeDefinitionEntity,
  AttributeValueEntity,
  ProductMediaEntity,
] as const;

export {
  AttributeDefinitionEntity,
  AttributeValueEntity,
  BrandEntity,
  CategoryEntity,
  CategoryTranslationEntity,
  CollectionEntity,
  ProductEntity,
  ProductMediaEntity,
  ProductTranslationEntity,
  ProductVariantEntity,
};
export type { FulfillmentMode } from './fulfillment-mode';
export { FULFILLMENT_MODES, assertFulfillmentMode, isFulfillmentMode } from './fulfillment-mode';
