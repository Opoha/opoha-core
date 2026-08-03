import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { vendorEventSchemas } from './vendor-events';

/** Registers marketplace vendor domain event Zod schemas on the in-process bus. */
@Injectable()
export class VendorEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of vendorEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
