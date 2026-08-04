import { Injectable, OnModuleInit, Optional } from '@nestjs/common';

import { ANALYTICS_EVENT_NAMES } from './analytics-catalog';
import { AnalyticsSinkRegistry } from './analytics-sink.registry';
import type { DomainEvent } from './domain-event';
import { EventBusService } from './event-bus.service';
import { AppLogger } from '../logging/app-logger';

/**
 * Forwards cataloged analytics events (ANALYTICS_EVENT_NAMES) to every active
 * AnalyticsSinkRegistry sink (Phase 4 F-04). Soft no-op with zero registered
 * sinks. Per-sink failures are isolated — never fails the originating event.
 * Delivery is at-least-once (matches EventBusService); sinks must dedupe
 * using the idempotency keys documented in analytics-events-design.md.
 */
@Injectable()
export class AnalyticsSinkDispatcher implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly sinks: AnalyticsSinkRegistry,
    @Optional() private readonly logger?: AppLogger,
  ) {}

  onModuleInit(): void {
    for (const eventName of ANALYTICS_EVENT_NAMES) {
      this.eventBus.subscribe(eventName, (event) => this.dispatch(event), {
        id: `analytics-sink-dispatcher:${eventName}`,
      });
    }
  }

  private async dispatch(event: DomainEvent): Promise<void> {
    for (const entry of this.sinks.list(true)) {
      try {
        await entry.sink.handle(event);
      } catch (error) {
        this.logger?.error(
          {
            message: 'Analytics sink failed',
            sinkCode: entry.sink.code,
            eventName: event.eventName,
            eventId: event.eventId,
            error: error instanceof Error ? error.message : String(error),
          },
          'AnalyticsSinkDispatcher',
        );
      }
    }
  }
}
