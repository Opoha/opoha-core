import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { BrandsResolver } from './brands/brands.resolver';
import { BrandsService } from './brands/brands.service';
import { CategoriesResolver } from './categories/categories.resolver';
import { CategoriesService } from './categories/categories.service';
import { CollectionsResolver } from './collections/collections.resolver';
import { CollectionsService } from './collections/collections.service';
import { catalogEntities } from './entities';
import { ProductsResolver } from './products/products.resolver';
import { ProductsService } from './products/products.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([...catalogEntities])],
  providers: [
    ProductsService,
    ProductsResolver,
    CategoriesService,
    CategoriesResolver,
    CollectionsService,
    CollectionsResolver,
    BrandsService,
    BrandsResolver,
  ],
  exports: [
    ProductsService,
    CategoriesService,
    CollectionsService,
    BrandsService,
    TypeOrmModule,
  ],
})
export class CatalogModule {}
