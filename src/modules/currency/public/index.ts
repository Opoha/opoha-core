/**
 * Public currency module surface.
 */
export { CurrencyModule } from '../currency.module';
export { StoreCurrencyConfigService } from '../store-currency-config.service';
export { ExchangeRateService } from '../exchange-rate.service';
export { FXRateProviderRegistry } from '../fx-rate-provider.registry';
export type {
  FXRateQuoteInput,
  FXRateQuoteResult,
  FXRateProvider,
  RegisteredFXRateProvider,
} from '../fx-rate-provider';
export { CurrencyConversionService } from '../currency-conversion.service';
export type {
  ConvertedAmount,
  DisplayTotalsInput,
  DisplayTotalsResult,
} from '../currency-conversion.service';
export {
  CURRENCY_ROUNDING_MODE,
  convertMinorWithRate,
  roundHalfUpToMinor,
} from '../currency-conversion';
export type { CurrencyRoundingMode } from '../currency-conversion';
export { StoreCurrencyConfigEntity, ExchangeRateEntity, currencyEntities } from '../entities';
export {
  DEFAULT_STORE_CURRENCY,
  defaultStoreCurrencyConfig,
} from '../store-currency-config.defaults';
export {
  StoreCurrencyConfigType,
  UpdateStoreCurrencyConfigInput,
} from '../store-currency-config.types';
export {
  ExchangeRateType,
  CreateExchangeRateInput,
  UpdateExchangeRateInput,
} from '../exchange-rate.types';
export type {
  StoreCurrencyConfigUpdatedData,
  StoreCurrencyConfigUpdatedEvent,
} from '../events/store-currency-config-events';
export type {
  ExchangeRateUpdatedData,
  ExchangeRateUpdatedEvent,
} from '../events/exchange-rate-events';
