import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { StoresModule } from '../stores/public';
import { CurrencyConversionService } from './currency-conversion.service';
import { currencyEntities } from './entities';
import { CurrencyEventsRegistrar } from './events/currency-events.registrar';
import { ExchangeRateResolver } from './exchange-rate.resolver';
import { ExchangeRateService } from './exchange-rate.service';
import { FXRateProviderRegistry } from './fx-rate-provider.registry';
import { StoreCreatedCurrencyConfigListener } from './store-created-currency-config.listener';
import { StoreCurrencyConfigResolver } from './store-currency-config.resolver';
import { StoreCurrencyConfigService } from './store-currency-config.service';

/**
 * Currency module — store display/settlement config, exchange rates,
 * cart/checkout display conversion, and optional FX provider port.
 */
@Module({
  imports: [AuthModule, StoresModule, TypeOrmModule.forFeature([...currencyEntities])],
  providers: [
    StoreCurrencyConfigService,
    StoreCurrencyConfigResolver,
    FXRateProviderRegistry,
    ExchangeRateService,
    ExchangeRateResolver,
    CurrencyConversionService,
    CurrencyEventsRegistrar,
    StoreCreatedCurrencyConfigListener,
  ],
  exports: [
    StoreCurrencyConfigService,
    ExchangeRateService,
    CurrencyConversionService,
    FXRateProviderRegistry,
    TypeOrmModule,
  ],
})
export class CurrencyModule {}
