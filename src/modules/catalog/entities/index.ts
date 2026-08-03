import { AttributeDefinitionEntity } from './attribute-definition.entity';
import { AttributeValueEntity } from './attribute-value.entity';
import { BrandEntity } from './brand.entity';
import { CategoryEntity } from './category.entity';
import { CollectionEntity } from './collection.entity';
import { ProductMediaEntity } from './product-media.entity';
import { ProductVariantEntity } from './product-variant.entity';
import { ProductEntity } from './product.entity';

export const catalogEntities = [
  ProductEntity,
  ProductVariantEntity,
  CategoryEntity,
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
  CollectionEntity,
  ProductEntity,
  ProductMediaEntity,
  ProductVariantEntity,
};
