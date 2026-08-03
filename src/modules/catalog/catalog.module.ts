import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { FilesModule } from '../files/public';
import { AttributesResolver } from './attributes/attributes.resolver';
import { AttributesService } from './attributes/attributes.service';
import { BrandsResolver } from './brands/brands.resolver';
import { BrandsService } from './brands/brands.service';
import { CategoriesResolver } from './categories/categories.resolver';
import { CategoriesService } from './categories/categories.service';
import { CollectionsResolver } from './collections/collections.resolver';
import { CollectionsService } from './collections/collections.service';
import { catalogEntities } from './entities';
import { ProductMediaResolver } from './media/product-media.resolver';
import { ProductMediaService } from './media/product-media.service';
import { ProductsResolver } from './products/products.resolver';
import { ProductsService } from './products/products.service';

@Module({
  imports: [
    AuthModule,
    FilesModule,
    TypeOrmModule.forFeature([...catalogEntities]),
  ],
  providers: [
    ProductsService,
    ProductsResolver,
    CategoriesService,
    CategoriesResolver,
    CollectionsService,
    CollectionsResolver,
    BrandsService,
    BrandsResolver,
    AttributesService,
    AttributesResolver,
    ProductMediaService,
    ProductMediaResolver,
  ],
  exports: [
    ProductsService,
    CategoriesService,
    CollectionsService,
    BrandsService,
    AttributesService,
    ProductMediaService,
    TypeOrmModule,
  ],
})
export class CatalogModule {}
