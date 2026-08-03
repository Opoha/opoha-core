import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { giftCardEntities } from './entities';
import { GiftCardService } from './gift-cards.service';

@Module({
  imports: [TypeOrmModule.forFeature([...giftCardEntities])],
  providers: [GiftCardService],
  exports: [GiftCardService, TypeOrmModule],
})
export class GiftCardsModule {}
