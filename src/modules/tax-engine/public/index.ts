/**
 * Public tax-engine surface for other core modules and plugin registration.
 */
export { TaxEngineModule } from '../tax-engine.module';
export { TaxEngine } from '../tax-engine.service';
export { TaxProviderRegistry } from '../tax-provider.registry';
export { TaxClassEntity } from '../entities/tax-class.entity';
export { TaxRuleEntity } from '../entities/tax-rule.entity';
export { taxEntities } from '../entities';
export type {
  MoneyAmount,
  TaxPricingMode,
  TaxAddress,
  TaxCalculateLineItem,
  TaxCalculateInput,
  TaxLineResult,
  TaxCalculateResult,
  TaxProvider,
  RegisteredTaxProvider,
} from '../tax-provider';
