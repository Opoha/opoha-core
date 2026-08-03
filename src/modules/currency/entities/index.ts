import { ExchangeRateEntity } from './exchange-rate.entity';
import { StoreCurrencyConfigEntity } from './store-currency-config.entity';

export { ExchangeRateEntity, StoreCurrencyConfigEntity };

/** TypeORM entities owned by the currency module. */
export const currencyEntities = [
  StoreCurrencyConfigEntity,
  ExchangeRateEntity,
] as const;
