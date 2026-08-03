import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { loyaltyEventSchemas } from './loyalty-events';

/** Registers loyalty domain event Zod schemas on the in-process bus. */
@Injectable()
export class LoyaltyEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of loyaltyEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
