import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { catalogEntities } from './entities';
import { ProductsResolver } from './products/products.resolver';
import { ProductsService } from './products/products.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([...catalogEntities])],
  providers: [ProductsService, ProductsResolver],
  exports: [ProductsService, TypeOrmModule],
})
export class CatalogModule {}
