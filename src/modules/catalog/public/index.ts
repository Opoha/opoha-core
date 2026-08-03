/**
 * Public catalog module surface.
 */
export { CatalogModule } from '../catalog.module';
export { ProductsService } from '../products/products.service';
export { CategoriesService } from '../categories/categories.service';
export { CollectionsService } from '../collections/collections.service';
export { BrandsService } from '../brands/brands.service';
export { AttributesService } from '../attributes/attributes.service';
export { ProductMediaService } from '../media/product-media.service';
export {
  AttributeDefinitionEntity,
  AttributeValueEntity,
  BrandEntity,
  CategoryEntity,
  CollectionEntity,
  ProductEntity,
  ProductMediaEntity,
  ProductVariantEntity,
  catalogEntities,
} from '../entities';
export type {
  CreateProductInput,
  UpdateProductInput,
  ProductType,
  ProductVariantType,
  ProductReviewAggregateType,
} from '../products/product.types';
export {
  REVIEW_AGGREGATE_PROVIDER_TOKEN,
  type ReviewAggregateProvider,
} from '../products/products.resolver';
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
export type {
  CreateAttributeDefinitionInput,
  UpdateAttributeDefinitionInput,
  SetProductAttributeInput,
  SetVariantAttributeInput,
  AttributeDefinitionType,
  AttributeValueType,
} from '../attributes/attribute.types';
export type {
  AttachProductMediaInput,
  UpdateProductMediaInput,
  ProductMediaType,
} from '../media/product-media.types';
