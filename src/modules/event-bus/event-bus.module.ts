import { Global, Module } from '@nestjs/common';

import { AnalyticsSinkDispatcher } from './analytics-sink.dispatcher';
import { AnalyticsSinkRegistry } from './analytics-sink.registry';
import { EventBusService } from './event-bus.service';

@Global()
@Module({
  providers: [EventBusService, AnalyticsSinkRegistry, AnalyticsSinkDispatcher],
  exports: [EventBusService, AnalyticsSinkRegistry],
})
export class EventBusModule {}
