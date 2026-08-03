import { CouponEntity } from './coupon.entity';
import { DiscountRuleEntity } from './discount-rule.entity';

export const promotionsEntities = [CouponEntity, DiscountRuleEntity] as const;

export { CouponEntity, DiscountRuleEntity };
export type { CouponKind } from './coupon.entity';
export type { DiscountRuleKind } from './discount-rule.entity';
