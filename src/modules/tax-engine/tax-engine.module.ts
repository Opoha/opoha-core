import { Global, Module } from '@nestjs/common';

import { TaxEngine } from './tax-engine.service';
import { TaxProviderRegistry } from './tax-provider.registry';

@Global()
@Module({
  providers: [TaxProviderRegistry, TaxEngine],
  exports: [TaxProviderRegistry, TaxEngine],
})
export class TaxEngineModule {}
