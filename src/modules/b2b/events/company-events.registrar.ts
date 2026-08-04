import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { b2bQuoteEventSchemas } from './b2b-quote-events';
import { companyEventSchemas } from './company-events';

/** Registers b2b module domain event Zod schemas. */
@Injectable()
export class CompanyEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of [...companyEventSchemas(), ...b2bQuoteEventSchemas()]) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
