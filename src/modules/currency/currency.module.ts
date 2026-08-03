import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/public';
import { StoresModule } from '../stores/public';
import { currencyEntities } from './entities';
import { StoreCurrencyConfigEventsRegistrar } from './events/store-currency-config-events.registrar';
import { StoreCreatedCurrencyConfigListener } from './store-created-currency-config.listener';
import { StoreCurrencyConfigResolver } from './store-currency-config.resolver';
import { StoreCurrencyConfigService } from './store-currency-config.service';

/**
 * Currency module — store/channel display vs settlement config (Phase 5 D-01).
 * Exchange rates land in D-02; cart conversion in D-03.
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
    StoreCurrencyConfigEventsRegistrar,
    StoreCreatedCurrencyConfigListener,
  ],
  exports: [StoreCurrencyConfigService, TypeOrmModule],
})
export class CurrencyModule {}
