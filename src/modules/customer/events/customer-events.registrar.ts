import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { customerEventSchemas } from './customer-events';

/** Registers customer domain event Zod schemas on the in-process bus. */
@Injectable()
export class CustomerEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of customerEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
