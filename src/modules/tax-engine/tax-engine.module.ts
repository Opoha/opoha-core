import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { TaxClassEntity } from './entities/tax-class.entity';
import { TaxRuleEntity } from './entities/tax-rule.entity';
import { TaxClassesService } from './tax-classes.service';
import { TaxEngine } from './tax-engine.service';
import { TaxProviderRegistry } from './tax-provider.registry';
import { TaxRulesService } from './tax-rules.service';
import { TaxResolver } from './tax.resolver';

@Global()
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([TaxClassEntity, TaxRuleEntity]),
  ],
  providers: [
    TaxProviderRegistry,
    TaxEngine,
    TaxClassesService,
    TaxRulesService,
    TaxResolver,
  ],
  exports: [
    TaxProviderRegistry,
    TaxEngine,
    TaxClassesService,
    TaxRulesService,
    TypeOrmModule,
  ],
})
export class TaxEngineModule {}
