import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { CatalogModule, ProductEntity } from '../catalog/public';
import { vendorEntities } from './entities';
import { VendorEventsRegistrar } from './events/vendor-events.registrar';
import { VendorResolver } from './vendor.resolver';
import { VendorService } from './vendor.service';

@Module({
  imports: [
    AuthModule,
    CatalogModule,
    TypeOrmModule.forFeature([...vendorEntities, ProductEntity]),
  ],
  providers: [VendorService, VendorResolver, VendorEventsRegistrar],
  exports: [VendorService, TypeOrmModule],
})
export class VendorsModule {}
