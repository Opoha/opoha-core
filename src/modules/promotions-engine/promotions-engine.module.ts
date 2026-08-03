import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CouponEntity } from './entities/coupon.entity';
import { DiscountRuleEntity } from './entities/discount-rule.entity';
import { PromotionsBootstrapService } from './promotions-bootstrap.service';
import { PromotionRuleRegistry } from './promotion-rule.registry';
import { PromotionsEngine } from './promotions-engine.service';
import { TypeOrmPromotionProvider } from './typeorm-promotion.provider';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CouponEntity, DiscountRuleEntity])],
  providers: [
    PromotionRuleRegistry,
    PromotionsEngine,
    TypeOrmPromotionProvider,
    PromotionsBootstrapService,
  ],
  exports: [
    PromotionRuleRegistry,
    PromotionsEngine,
    TypeOrmPromotionProvider,
    TypeOrmModule,
  ],
})
export class PromotionsEngineModule {}
