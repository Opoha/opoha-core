import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { CouponsService } from './coupons.service';
import { DiscountRulesService } from './discount-rules.service';
import { CouponEntity } from './entities/coupon.entity';
import { DiscountRuleEntity } from './entities/discount-rule.entity';
import { PromotionsBootstrapService } from './promotions-bootstrap.service';
import { PromotionRuleRegistry } from './promotion-rule.registry';
import { PromotionsEngine } from './promotions-engine.service';
import { PromotionsResolver } from './promotions.resolver';
import { TypeOrmPromotionProvider } from './typeorm-promotion.provider';

@Global()
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([CouponEntity, DiscountRuleEntity]),
  ],
  providers: [
    PromotionRuleRegistry,
    PromotionsEngine,
    TypeOrmPromotionProvider,
    PromotionsBootstrapService,
    CouponsService,
    DiscountRulesService,
    PromotionsResolver,
  ],
  exports: [
    PromotionRuleRegistry,
    PromotionsEngine,
    TypeOrmPromotionProvider,
    CouponsService,
    DiscountRulesService,
    TypeOrmModule,
  ],
})
export class PromotionsEngineModule {}
