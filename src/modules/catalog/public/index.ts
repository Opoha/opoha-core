/**
 * Public catalog module surface.
 */
export { CatalogModule } from '../catalog.module';
export { ProductsService } from '../products/products.service';
export { CategoriesService } from '../categories/categories.service';
export { CollectionsService } from '../collections/collections.service';
export { BrandsService } from '../brands/brands.service';
export {
  BrandEntity,
  CategoryEntity,
  CollectionEntity,
  ProductEntity,
  ProductVariantEntity,
  catalogEntities,
} from '../entities';
export type {
  CreateProductInput,
  UpdateProductInput,
  ProductType,
  ProductVariantType,
} from '../products/product.types';
export type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryType,
} from '../categories/category.types';
export type {
  CreateCollectionInput,
  UpdateCollectionInput,
  CollectionType,
} from '../collections/collection.types';
export type {
  CreateBrandInput,
  UpdateBrandInput,
  BrandType,
} from '../brands/brand.types';
