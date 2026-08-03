import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CouponEntity } from './entities/coupon.entity';
import { DiscountRuleEntity } from './entities/discount-rule.entity';
import { PromotionRuleRegistry } from './promotion-rule.registry';
import { PromotionsEngine } from './promotions-engine.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CouponEntity, DiscountRuleEntity])],
  providers: [PromotionRuleRegistry, PromotionsEngine],
  exports: [PromotionRuleRegistry, PromotionsEngine, TypeOrmModule],
})
export class PromotionsEngineModule {}
