import { Injectable, OnModuleInit } from '@nestjs/common';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import type { StoreCreatedEvent } from '../stores/public';
import { StoreChannelSettingsService } from './store-channel-settings.service';

/**
 * Seed default channel settings when a store is created (Phase 5 B-03).
 */
@Injectable()
export class StoreCreatedChannelSettingsListener implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly channelSettings: StoreChannelSettingsService,
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
    await this.channelSettings.ensureForStore(storeId);
  }
}
