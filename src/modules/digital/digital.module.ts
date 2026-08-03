import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { CatalogModule, ProductVariantEntity } from '../catalog/public';
import { EventBusModule } from '../event-bus/event-bus.module';
import { DigitalFulfillmentService } from './digital-fulfillment.service';
import { DigitalResolver } from './digital.resolver';
import { digitalEntities } from './entities';
import { DigitalEventsRegistrar } from './events/digital-events.registrar';

@Module({
  imports: [
    AuthModule,
    CatalogModule,
    EventBusModule,
    TypeOrmModule.forFeature([...digitalEntities, ProductVariantEntity]),
  ],
  providers: [
    DigitalFulfillmentService,
    DigitalResolver,
    DigitalEventsRegistrar,
  ],
  exports: [DigitalFulfillmentService, TypeOrmModule],
})
export class DigitalModule {}
