import { Global, Module } from '@nestjs/common';

import { PaymentEngine } from './payment-engine.service';
import { PaymentProviderRegistry } from './payment-provider.registry';

@Global()
@Module({
  providers: [PaymentProviderRegistry, PaymentEngine],
  exports: [PaymentProviderRegistry, PaymentEngine],
})
export class PaymentEngineModule {}
