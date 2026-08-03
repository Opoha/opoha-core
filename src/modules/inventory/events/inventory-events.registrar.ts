import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { inventoryEventSchemas } from './inventory-events';

/** Registers inventory domain event Zod schemas on the in-process bus. */
@Injectable()
export class InventoryEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of inventoryEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
