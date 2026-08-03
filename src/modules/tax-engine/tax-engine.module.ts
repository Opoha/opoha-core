import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TaxClassEntity } from './entities/tax-class.entity';
import { TaxRuleEntity } from './entities/tax-rule.entity';
import { TaxEngine } from './tax-engine.service';
import { TaxProviderRegistry } from './tax-provider.registry';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([TaxClassEntity, TaxRuleEntity])],
  providers: [TaxProviderRegistry, TaxEngine],
  exports: [TaxProviderRegistry, TaxEngine, TypeOrmModule],
})
export class TaxEngineModule {}
