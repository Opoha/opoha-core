import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { StoresModule } from '../stores/public';
import { warehouseEntities } from './entities';
import { WarehouseEventsRegistrar } from './events/warehouse-events.registrar';
import { StoreCreatedWarehouseListener } from './store-created-warehouse.listener';
import { StoreWarehouseResolver } from './store-warehouse.resolver';
import { StoreWarehouseService } from './store-warehouse.service';
import { WarehouseResolver } from './warehouse.resolver';
import { WarehouseService } from './warehouse.service';

@Module({
  imports: [AuthModule, StoresModule, TypeOrmModule.forFeature([...warehouseEntities])],
  providers: [
    WarehouseService,
    WarehouseResolver,
    StoreWarehouseService,
    StoreWarehouseResolver,
    WarehouseEventsRegistrar,
    StoreCreatedWarehouseListener,
  ],
  exports: [WarehouseService, StoreWarehouseService, TypeOrmModule],
})
export class WarehousesModule {}
