import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { InventoryModule } from '../inventory/public';
import { OrderModule } from '../order/public';
import { ShippingEngineModule } from '../shipping-engine/public';
import { WarehousesModule } from '../warehouses/public';
import { fulfillmentEntities } from './entities';
import { FulfillmentEventsRegistrar } from './events/fulfillment-events.registrar';
import { FulfillmentResolver } from './fulfillment.resolver';
import { FulfillmentService } from './fulfillment.service';

@Module({
  imports: [
    AuthModule,
    WarehousesModule,
    InventoryModule,
    OrderModule,
    ShippingEngineModule,
    TypeOrmModule.forFeature([...fulfillmentEntities]),
  ],
  providers: [
    FulfillmentService,
    FulfillmentResolver,
    FulfillmentEventsRegistrar,
  ],
  exports: [FulfillmentService, TypeOrmModule],
})
export class FulfillmentModule {}
