import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { StoresModule } from '../stores/public';
import { currencyEntities } from './entities';
import { CurrencyEventsRegistrar } from './events/currency-events.registrar';
import { ExchangeRateResolver } from './exchange-rate.resolver';
import { ExchangeRateService } from './exchange-rate.service';
import { StoreCreatedCurrencyConfigListener } from './store-created-currency-config.listener';
import { StoreCurrencyConfigResolver } from './store-currency-config.resolver';
import { StoreCurrencyConfigService } from './store-currency-config.service';

/**
 * Currency module — store display/settlement config (D-01) + exchange rates (D-02).
 * Cart conversion lands in D-03.
 */
@Module({
  imports: [
    AuthModule,
    StoresModule,
    TypeOrmModule.forFeature([...currencyEntities]),
  ],
  providers: [
    StoreCurrencyConfigService,
    StoreCurrencyConfigResolver,
    ExchangeRateService,
    ExchangeRateResolver,
    CurrencyEventsRegistrar,
    StoreCreatedCurrencyConfigListener,
  ],
  exports: [
    StoreCurrencyConfigService,
    ExchangeRateService,
    TypeOrmModule,
  ],
})
export class CurrencyModule {}
