import { Injectable, OnModuleInit } from '@nestjs/common';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import type { StoreCreatedEvent } from '../stores/public';
import { StoreCurrencyConfigService } from './store-currency-config.service';

/**
 * Seed default currency config when a store is created (Phase 5 D-01).
 */
@Injectable()
export class StoreCreatedCurrencyConfigListener implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly currencyConfig: StoreCurrencyConfigService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe(CoreEventName.StoreCreated, (event) =>
      this.onStoreCreated(event as StoreCreatedEvent),
    );
  }

  private async onStoreCreated(event: StoreCreatedEvent): Promise<void> {
    const storeId = event.data.storeId;
    if (!storeId) {
      return;
    }
    await this.currencyConfig.ensureForStore(
      storeId,
      event.data.defaultCurrencyCode,
    );
  }
}
