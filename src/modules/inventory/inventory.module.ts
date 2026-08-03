import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { WarehousesModule } from '../warehouses/public';
import { inventoryEntities } from './entities';
import { InventoryEventsRegistrar } from './events/inventory-events.registrar';
import { InventoryResolver } from './inventory.resolver';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    AuthModule,
    WarehousesModule,
    TypeOrmModule.forFeature([...inventoryEntities]),
  ],
  providers: [InventoryService, InventoryResolver, InventoryEventsRegistrar],
  exports: [InventoryService, TypeOrmModule],
})
export class InventoryModule {}
