import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import type { DomainEvent } from '../event-bus/domain-event';
import { EventBusService } from '../event-bus/event-bus.service';
import { AppLogger } from '../logging/app-logger';
import { WebhookDeliveryAttemptEntity } from './entities/webhook-delivery-attempt.entity';
import { WebhookDeliveryWorker } from './webhook-delivery.worker';
import { WebhooksService } from './webhooks.service';

/**
 * Cataloged commerce events that enqueue outbound webhook deliveries
 *. Endpoints still filter by their `eventNames` list.
 */
export const WEBHOOK_TRIGGER_EVENTS: readonly string[] = [
  CoreEventName.OrderCreated,
  CoreEventName.OrderPaid,
  CoreEventName.OrderStatusChanged,
  CoreEventName.OrderCancelled,
  CoreEventName.PaymentAuthorized,
  CoreEventName.PaymentCaptured,
  CoreEventName.PaymentFailed,
  CoreEventName.PaymentRefunded,
  CoreEventName.CustomerCreated,
  CoreEventName.ShipmentCreated,
  CoreEventName.ShipmentDelivered,
  CoreEventName.ReturnRequested,
  CoreEventName.RefundCompleted,
  CoreEventName.PosSaleCompleted,
  CoreEventName.SubscriptionRenewed,
];

export type EnqueueResult = {
  eventName: string;
  eventId: string;
  enqueued: number;
  attemptIds: string[];
};

/**
 * Subscribes to cataloged domain events and enqueues signed delivery attempts.
 */
@Injectable()
export class WebhookDispatcherService implements OnModuleInit {
  private readonly unsubscribers: Array<() => void> = [];
  /** When true, processDue runs immediately after enqueue (dev / tests). */
  private autoDeliver = false;

  constructor(
    private readonly webhooks: WebhooksService,
    private readonly worker: WebhookDeliveryWorker,
    private readonly eventBus: EventBusService,
    @InjectRepository(WebhookDeliveryAttemptEntity)
    private readonly attempts: Repository<WebhookDeliveryAttemptEntity>,
    @Optional() private readonly logger?: AppLogger,
  ) {}

  onModuleInit(): void {
    for (const eventName of WEBHOOK_TRIGGER_EVENTS) {
      const unsub = this.eventBus.subscribe(
        eventName,
        async (event) => {
          await this.onEvent(event);
        },
        { id: `webhook-dispatcher:${eventName}` },
      );
      this.unsubscribers.push(unsub);
    }
  }

  /** Detach listeners (tests). */
  dispose(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
  }

  /** Enable immediate delivery after enqueue (unit / gate tests). */
  setAutoDeliver(enabled: boolean): this {
    this.autoDeliver = enabled;
    return this;
  }

  async onEvent(event: DomainEvent): Promise<EnqueueResult> {
    return this.enqueueForEvent(event);
  }

  async enqueueForEvent(event: DomainEvent): Promise<EnqueueResult> {
    const endpoints = await this.webhooks.findEnabledForEvent(event.eventName);
    const attemptIds: string[] = [];
    const now = new Date();

    const payload: Record<string, unknown> = {
      eventId: event.eventId,
      eventName: event.eventName,
      occurredAt: event.occurredAt,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payloadVersion: event.payloadVersion,
      data: event.data ?? {},
    };

    for (const endpoint of endpoints) {
      const row = this.attempts.create({
        endpointId: endpoint.id,
        eventName: event.eventName,
        eventId: event.eventId,
        payload,
        status: 'pending',
        attempt: 1,
        nextAttemptAt: now,
        responseStatus: null,
        responseBody: null,
        errorMessage: null,
        signature: null,
        finishedAt: null,
      });
      const saved = await this.attempts.save(row);
      attemptIds.push(saved.id);
    }

    if (this.autoDeliver && attemptIds.length > 0) {
      try {
        await this.worker.processDue(now);
      } catch (err: unknown) {
        this.logger?.warn(
          `Webhook auto-deliver failed: ${err instanceof Error ? err.message : String(err)}`,
          'WebhookDispatcherService',
        );
      }
    }

    return {
      eventName: event.eventName,
      eventId: event.eventId,
      enqueued: attemptIds.length,
      attemptIds,
    };
  }
}
