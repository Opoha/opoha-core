import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { storeEventSchemas } from './store-events';

/** Registers store domain event Zod schemas on the in-process bus. */
@Injectable()
export class StoreEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of storeEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
