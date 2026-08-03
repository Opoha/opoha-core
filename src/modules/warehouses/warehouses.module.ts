import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { warehouseEntities } from './entities';
import { WarehouseEventsRegistrar } from './events/warehouse-events.registrar';
import { WarehouseResolver } from './warehouse.resolver';
import { WarehouseService } from './warehouse.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([...warehouseEntities])],
  providers: [WarehouseService, WarehouseResolver, WarehouseEventsRegistrar],
  exports: [WarehouseService, TypeOrmModule],
})
export class WarehousesModule {}
