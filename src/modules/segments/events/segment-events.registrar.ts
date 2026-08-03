import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { segmentEventSchemas } from './segment-events';

/** Registers segment domain event Zod schemas on the in-process bus. */
@Injectable()
export class SegmentEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of segmentEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
