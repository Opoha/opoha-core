import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { exchangeRateEventSchemas } from './exchange-rate-events';
import { storeCurrencyConfigEventSchemas } from './store-currency-config-events';

/** Registers currency module domain event Zod schemas. */
@Injectable()
export class CurrencyEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of [
...storeCurrencyConfigEventSchemas(),
...exchangeRateEventSchemas(),
    ]) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
