import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InventoryModule } from '../inventory/public';
import { OrderModule } from '../order/public';
import { WarehousesModule } from '../warehouses/public';
import { fulfillmentEntities } from './entities';
import { FulfillmentEventsRegistrar } from './events/fulfillment-events.registrar';
import { FulfillmentService } from './fulfillment.service';

@Module({
  imports: [
    WarehousesModule,
    InventoryModule,
    OrderModule,
    TypeOrmModule.forFeature([...fulfillmentEntities]),
  ],
  providers: [FulfillmentService, FulfillmentEventsRegistrar],
  exports: [FulfillmentService, TypeOrmModule],
})
export class FulfillmentModule {}
