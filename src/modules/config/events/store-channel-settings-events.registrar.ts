import { Injectable, OnModuleInit } from '@nestjs/common';

import { EventBusService } from '../../event-bus/event-bus.service';
import { storeChannelSettingsEventSchemas } from './store-channel-settings-events';

/** Registers store channel settings domain event Zod schemas. */
@Injectable()
export class StoreChannelSettingsEventsRegistrar implements OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit(): void {
    for (const { eventName, schema } of storeChannelSettingsEventSchemas()) {
      this.eventBus.registerSchema(eventName, schema);
    }
  }
}
