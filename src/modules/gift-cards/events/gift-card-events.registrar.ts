import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { giftCardEventSchemas } from './gift-card-events';

/** Registers gift-card domain event Zod schemas on the in-process bus. */
@Injectable()
export class GiftCardEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of giftCardEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
