/**
 * Public promotions-engine surface for other core modules and plugin registration.
 */
export { PromotionsEngineModule } from '../promotions-engine.module';
export { PromotionsEngine } from '../promotions-engine.service';
export { PromotionRuleRegistry } from '../promotion-rule.registry';
export { TypeOrmPromotionProvider } from '../typeorm-promotion.provider';
export { CouponsService } from '../coupons.service';
export { DiscountRulesService } from '../discount-rules.service';
export { CouponEntity } from '../entities/coupon.entity';
export { DiscountRuleEntity } from '../entities/discount-rule.entity';
export { promotionsEntities } from '../entities';
export type { CouponKind } from '../entities/coupon.entity';
export type { DiscountRuleKind } from '../entities/discount-rule.entity';
export type {
  PromotionApplyLineItem,
  PromotionApplyInput,
  PromotionApplicationKind,
  PromotionApplication,
  PromotionApplyResult,
  PromotionRuleProvider,
  RegisteredPromotionRuleProvider,
} from '../promotion-rule';
export {
  extractSegmentRestriction,
  membershipContextFromApplyInput,
} from '../segment-eligibility';
export type { SegmentRestriction } from '../segment-eligibility';
