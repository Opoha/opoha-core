import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { storeCurrencyConfigEventSchemas } from './store-currency-config-events';

/** Registers store currency config domain event Zod schemas. */
@Injectable()
export class StoreCurrencyConfigEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of storeCurrencyConfigEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
