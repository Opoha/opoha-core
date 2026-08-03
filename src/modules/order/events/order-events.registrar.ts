import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { orderEventSchemas } from './order-events';

/** Registers cart/order domain event Zod schemas on the in-process bus. */
@Injectable()
export class OrderEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of orderEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
