import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentEntity } from './entities/payment.entity';
import { PaymentEngine } from './payment-engine.service';
import { PaymentProviderRegistry } from './payment-provider.registry';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity])],
  providers: [PaymentProviderRegistry, PaymentEngine],
  exports: [PaymentProviderRegistry, PaymentEngine, TypeOrmModule],
})
export class PaymentEngineModule {}
