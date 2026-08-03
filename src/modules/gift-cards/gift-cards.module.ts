import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EventBusModule } from '../event-bus/event-bus.module';
import { giftCardEntities } from './entities';
import { GiftCardEventsRegistrar } from './events/gift-card-events.registrar';
import { GiftCardService } from './gift-cards.service';

@Module({
  imports: [EventBusModule, TypeOrmModule.forFeature([...giftCardEntities])],
  providers: [GiftCardService, GiftCardEventsRegistrar],
  exports: [GiftCardService, TypeOrmModule],
})
export class GiftCardsModule {}
