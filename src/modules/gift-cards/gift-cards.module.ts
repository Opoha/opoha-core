import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { EventBusModule } from '../event-bus/event-bus.module';
import { giftCardEntities } from './entities';
import { GiftCardEventsRegistrar } from './events/gift-card-events.registrar';
import { GiftCardsResolver } from './gift-cards.resolver';
import { GiftCardService } from './gift-cards.service';

@Module({
  imports: [
    AuthModule,
    EventBusModule,
    TypeOrmModule.forFeature([...giftCardEntities]),
  ],
  providers: [GiftCardService, GiftCardsResolver, GiftCardEventsRegistrar],
  exports: [GiftCardService, TypeOrmModule],
})
export class GiftCardsModule {}
