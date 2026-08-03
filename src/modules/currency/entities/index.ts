import { StoreCurrencyConfigEntity } from './store-currency-config.entity';

export { StoreCurrencyConfigEntity };

/** TypeORM entities owned by the currency module. */
export const currencyEntities = [StoreCurrencyConfigEntity] as const;
