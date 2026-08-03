import { Injectable, Optional } from '@nestjs/common';
import type { ZodType } from 'zod';

import { AppLogger } from '../logging/app-logger';
import {
  createDomainEvent,
  type DomainEvent,
  type EventErrorPolicy,
  type EventListener,
  type PublishInput,
  type SubscribeOptions,
} from './domain-event';

type RegisteredListener = {
  id: string;
  handler: EventListener;
  errorPolicy: EventErrorPolicy;
};

export type PublishResult = {
  event: DomainEvent;
  listenerCount: number;
  failures: Array<{ listenerId: string; error: unknown }>;
};

/**
 * In-process sync event bus. Core publishes; plugins/modules subscribe.
 * Listener failures are isolated by default (ADR-0004 / event-bus-design).
 */
@Injectable()
export class EventBusService {
  private readonly listeners = new Map<string, RegisteredListener[]>();
  private readonly schemas = new Map<string, ZodType>();
  private listenerSeq = 0;

  constructor(@Optional() private readonly logger?: AppLogger) {}

  /**
   * Register a Zod schema used to validate `data` before publish for `eventName`.
   */
  registerSchema(eventName: string, schema: ZodType): void {
    this.schemas.set(eventName, schema);
  }

  subscribe<T = unknown>(
    eventName: string,
    handler: EventListener<T>,
    options: SubscribeOptions = {},
  ): () => void {
    const id = options.id ?? `listener-${++this.listenerSeq}`;
    const entry: RegisteredListener = {
      id,
      handler: handler as EventListener,
      errorPolicy: options.errorPolicy ?? 'isolate',
    };
    const list = this.listeners.get(eventName) ?? [];
    list.push(entry);
    this.listeners.set(eventName, list);

    return () => {
      const current = this.listeners.get(eventName);
      if (!current) {
        return;
      }
      const next = current.filter((l) => l.id !== id);
      if (next.length === 0) {
        this.listeners.delete(eventName);
      } else {
        this.listeners.set(eventName, next);
      }
    };
  }

  listenerCount(eventName?: string): number {
    if (eventName) {
      return this.listeners.get(eventName)?.length ?? 0;
    }
    let total = 0;
    for (const list of this.listeners.values()) {
      total += list.length;
    }
    return total;
  }

  async publish<T>(input: PublishInput<T>): Promise<PublishResult> {
    const schema = this.schemas.get(input.eventName);
    const data = schema ? schema.parse(input.data) : input.data;
    const event = createDomainEvent({ ...input, data });

    const list = this.listeners.get(event.eventName) ?? [];
    const failures: PublishResult['failures'] = [];
    let throwError: unknown;

    for (const listener of list) {
      try {
        await listener.handler(event);
      } catch (error: unknown) {
        failures.push({ listenerId: listener.id, error });
        this.logger?.error(
          {
            message: 'Event listener failed',
            eventName: event.eventName,
            eventId: event.eventId,
            listenerId: listener.id,
            error: error instanceof Error ? error.message : String(error),
          },
          'EventBusService',
        );
        if (listener.errorPolicy === 'throw' && throwError === undefined) {
          throwError = error;
        }
      }
    }

    if (throwError !== undefined) {
      throw throwError;
    }

    return { event, listenerCount: list.length, failures };
  }
}
