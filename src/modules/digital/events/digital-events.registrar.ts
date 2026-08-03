import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { digitalEventSchemas } from './digital-events';

/** Registers digital fulfillment domain event Zod schemas on the in-process bus. */
@Injectable()
export class DigitalEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of digitalEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
