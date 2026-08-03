import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { authEventSchemas } from './auth-events';

/** Registers auth domain event Zod schemas on the in-process bus. */
@Injectable()
export class AuthEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of authEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
