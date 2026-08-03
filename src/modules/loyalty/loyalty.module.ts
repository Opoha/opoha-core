import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { EventBusModule } from '../event-bus/event-bus.module';
import { loyaltyEntities } from './entities';
import { LoyaltyEventsRegistrar } from './events/loyalty-events.registrar';
import { LoyaltyResolver } from './loyalty.resolver';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [
    AuthModule,
    EventBusModule,
    TypeOrmModule.forFeature([...loyaltyEntities]),
  ],
  providers: [LoyaltyService, LoyaltyResolver, LoyaltyEventsRegistrar],
  exports: [LoyaltyService, TypeOrmModule],
})
export class LoyaltyModule {}
