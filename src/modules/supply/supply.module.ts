import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { InventoryModule } from '../inventory/public';
import { WarehousesModule } from '../warehouses/public';
import { supplyEntities } from './entities';
import { SupplyEventsRegistrar } from './events/supply-events.registrar';
import { PurchaseOrderResolver } from './purchase-order.resolver';
import { PurchaseOrderService } from './purchase-order.service';
import { SupplierResolver } from './supplier.resolver';
import { SupplierService } from './supplier.service';

@Module({
  imports: [
    AuthModule,
    WarehousesModule,
    InventoryModule,
    TypeOrmModule.forFeature([...supplyEntities]),
  ],
  providers: [
    SupplierService,
    SupplierResolver,
    PurchaseOrderService,
    PurchaseOrderResolver,
    SupplyEventsRegistrar,
  ],
  exports: [SupplierService, PurchaseOrderService, TypeOrmModule],
})
export class SupplyModule {}
