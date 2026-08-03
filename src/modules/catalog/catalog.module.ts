import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { ConfigurationSettingsModule } from '../config/public';
import { EventBusModule } from '../event-bus/event-bus.module';
import { FilesModule } from '../files/public';
import { PluginLoaderModule } from '../plugin-loader/public';
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
import { CatalogTranslationsService } from './translations/catalog-translations.service';

@Module({
  imports: [
    AuthModule,
    ConfigurationSettingsModule,
    EventBusModule,
    FilesModule,
    PluginLoaderModule,
    TypeOrmModule.forFeature([...catalogEntities]),
  ],
  providers: [
    CatalogTranslationsService,
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
    CatalogTranslationsService,
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
