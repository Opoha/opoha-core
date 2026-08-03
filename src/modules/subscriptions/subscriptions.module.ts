import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { EventBusModule } from '../event-bus/event-bus.module';
import { PaymentEngineModule } from '../payment-engine/public';
import { subscriptionEntities } from './entities';
import { SubscriptionEventsRegistrar } from './events/subscription-events.registrar';
import { SubscriptionResolver } from './subscription.resolver';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [
    AuthModule,
    EventBusModule,
    PaymentEngineModule,
    TypeOrmModule.forFeature([...subscriptionEntities]),
  ],
  providers: [
    SubscriptionService,
    SubscriptionResolver,
    SubscriptionEventsRegistrar,
  ],
  exports: [SubscriptionService, TypeOrmModule],
})
export class SubscriptionsModule {}
