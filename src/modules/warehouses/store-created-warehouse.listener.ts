import { Injectable, OnModuleInit } from '@nestjs/common';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import type { StoreCreatedEvent } from '../stores/public';
import { StoreWarehouseService } from './store-warehouse.service';

/**
 * Seed default warehouse association when a store is created.
 */
@Injectable()
export class StoreCreatedWarehouseListener implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly storeWarehouses: StoreWarehouseService,
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
    await this.storeWarehouses.ensureDefaultForStore(storeId);
  }
}
