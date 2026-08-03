import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { paymentEventSchemas } from './payment-events';

/** Registers payment domain event Zod schemas on the in-process bus. */
@Injectable()
export class PaymentEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of paymentEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
