import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { WarehousesModule } from '../warehouses/public';
import { inventoryEntities } from './entities';
import { InventoryEventsRegistrar } from './events/inventory-events.registrar';
import { InventoryResolver } from './inventory.resolver';
import { InventoryService } from './inventory.service';
import { StockTransferResolver } from './stock-transfer.resolver';
import { StockTransferService } from './stock-transfer.service';

@Module({
  imports: [
    AuthModule,
    WarehousesModule,
    TypeOrmModule.forFeature([...inventoryEntities]),
  ],
  providers: [
    InventoryService,
    InventoryResolver,
    StockTransferService,
    StockTransferResolver,
    InventoryEventsRegistrar,
  ],
  exports: [InventoryService, StockTransferService, TypeOrmModule],
})
export class InventoryModule {}
