import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { InventoryModule } from '../inventory/public';
import { OrderModule } from '../order/public';
import { PaymentEngineModule } from '../payment-engine/public';
import { WarehousesModule } from '../warehouses/public';
import { returnEntities } from './entities';
import { ReturnEventsRegistrar } from './events/return-events.registrar';
import { ReturnsResolver } from './returns.resolver';
import { ReturnsService } from './returns.service';

@Module({
  imports: [
    AuthModule,
    WarehousesModule,
    InventoryModule,
    OrderModule,
    PaymentEngineModule,
    TypeOrmModule.forFeature([...returnEntities]),
  ],
  providers: [ReturnsService, ReturnsResolver, ReturnEventsRegistrar],
  exports: [ReturnsService, TypeOrmModule],
})
export class ReturnsModule {}
