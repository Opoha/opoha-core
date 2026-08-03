import { BrandEntity } from './brand.entity';
import { CategoryEntity } from './category.entity';
import { CollectionEntity } from './collection.entity';
import { ProductVariantEntity } from './product-variant.entity';
import { ProductEntity } from './product.entity';

export const catalogEntities = [
  ProductEntity,
  ProductVariantEntity,
  CategoryEntity,
  CollectionEntity,
  BrandEntity,
] as const;

export {
  BrandEntity,
  CategoryEntity,
  CollectionEntity,
  ProductEntity,
  ProductVariantEntity,
};
