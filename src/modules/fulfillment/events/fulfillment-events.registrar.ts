import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { fulfillmentEventSchemas } from './fulfillment-events';

/** Registers fulfillment domain event Zod schemas on the in-process bus. */
@Injectable()
export class FulfillmentEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of fulfillmentEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
