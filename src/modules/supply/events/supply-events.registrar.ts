import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { supplyEventSchemas } from './supply-events';

/** Registers supply domain event Zod schemas on the in-process bus. */
@Injectable()
export class SupplyEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of supplyEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
