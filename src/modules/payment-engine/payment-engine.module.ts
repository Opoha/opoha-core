import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentEntity } from './entities/payment.entity';
import { PaymentWebhookEventEntity } from './entities/payment-webhook-event.entity';
import { PaymentEngine } from './payment-engine.service';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { PaymentWebhookController } from './payment-webhook.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity, PaymentWebhookEventEntity]),
  ],
  controllers: [PaymentWebhookController],
  providers: [PaymentProviderRegistry, PaymentEngine],
  exports: [PaymentProviderRegistry, PaymentEngine, TypeOrmModule],
})
export class PaymentEngineModule {}
