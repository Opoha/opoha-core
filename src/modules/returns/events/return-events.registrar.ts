import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { returnEventSchemas } from './return-events';

/** Registers returns domain event Zod schemas on the in-process bus. */
@Injectable()
export class ReturnEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of returnEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
