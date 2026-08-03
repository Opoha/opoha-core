import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { warehouseEventSchemas } from './warehouse-events';

/** Registers warehouse domain event Zod schemas on the in-process bus. */
@Injectable()
export class WarehouseEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of warehouseEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
