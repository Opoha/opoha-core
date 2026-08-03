import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InventoryModule } from '../inventory/public';
import { OrderModule } from '../order/public';
import { PaymentEngineModule } from '../payment-engine/public';
import { WarehousesModule } from '../warehouses/public';
import { returnEntities } from './entities';
import { ReturnEventsRegistrar } from './events/return-events.registrar';
import { ReturnsService } from './returns.service';

@Module({
  imports: [
    WarehousesModule,
    InventoryModule,
    OrderModule,
    PaymentEngineModule,
    TypeOrmModule.forFeature([...returnEntities]),
  ],
  providers: [ReturnsService, ReturnEventsRegistrar],
  exports: [ReturnsService, TypeOrmModule],
})
export class ReturnsModule {}
