/**
 * Public tax-engine surface for other core modules and plugin registration.
 */
export { TaxEngineModule } from '../tax-engine.module';
export { TaxEngine } from '../tax-engine.service';
export { TaxProviderRegistry } from '../tax-provider.registry';
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
