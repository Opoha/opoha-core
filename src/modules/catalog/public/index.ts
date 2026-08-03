/**
 * Public catalog module surface.
 */
export { CatalogModule } from '../catalog.module';
export { ProductsService } from '../products/products.service';
export { ProductEntity, ProductVariantEntity, catalogEntities } from '../entities';
export type {
  CreateProductInput,
  UpdateProductInput,
  ProductType,
  ProductVariantType,
} from '../products/product.types';
