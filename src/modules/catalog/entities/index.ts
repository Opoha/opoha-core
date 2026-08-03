import { ProductVariantEntity } from './product-variant.entity';
import { ProductEntity } from './product.entity';

export const catalogEntities = [ProductEntity, ProductVariantEntity] as const;

export { ProductEntity, ProductVariantEntity };
