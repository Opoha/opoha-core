import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { subscriptionEventSchemas } from './subscription-events';

/** Registers subscription domain event Zod schemas on the in-process bus. */
@Injectable()
export class SubscriptionEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of subscriptionEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
