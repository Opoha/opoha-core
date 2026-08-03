import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EventBusModule } from '../event-bus/event-bus.module';
import { loyaltyEntities } from './entities';
import { LoyaltyEventsRegistrar } from './events/loyalty-events.registrar';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [
    EventBusModule,
    TypeOrmModule.forFeature([...loyaltyEntities]),
  ],
  providers: [LoyaltyService, LoyaltyEventsRegistrar],
  exports: [LoyaltyService, TypeOrmModule],
})
export class LoyaltyModule {}
