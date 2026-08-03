/**
 * Public promotions-engine surface for other core modules and plugin registration.
 */
export { PromotionsEngineModule } from '../promotions-engine.module';
export { PromotionsEngine } from '../promotions-engine.service';
export { PromotionRuleRegistry } from '../promotion-rule.registry';
export type {
  PromotionApplyLineItem,
  PromotionApplyInput,
  PromotionApplicationKind,
  PromotionApplication,
  PromotionApplyResult,
  PromotionRuleProvider,
  RegisteredPromotionRuleProvider,
} from '../promotion-rule';
