import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentWebhookEventEntity } from './entities/payment-webhook-event.entity';
import { PaymentEngine } from './payment-engine.service';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { PaymentResolver } from './payment.resolver';
import { PaymentWebhookController } from './payment-webhook.controller';

@Global()
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([PaymentEntity, PaymentWebhookEventEntity]),
  ],
  controllers: [PaymentWebhookController],
  providers: [PaymentProviderRegistry, PaymentEngine, PaymentResolver],
  exports: [PaymentProviderRegistry, PaymentEngine, TypeOrmModule],
})
export class PaymentEngineModule {}
