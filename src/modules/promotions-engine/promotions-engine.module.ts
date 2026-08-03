import { Global, Module } from '@nestjs/common';

import { PromotionRuleRegistry } from './promotion-rule.registry';
import { PromotionsEngine } from './promotions-engine.service';

@Global()
@Module({
  providers: [PromotionRuleRegistry, PromotionsEngine],
  exports: [PromotionRuleRegistry, PromotionsEngine],
})
export class PromotionsEngineModule {}
