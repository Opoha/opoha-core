import { z } from 'zod';

/**
 * Domain event envelope — payloads are plain DTOs, never TypeORM entities.
 * @see docs/design/event-bus-design.md
 */
export const domainEventMetadataSchema = z
  .object({
    correlationId: z.string().min(1).optional(),
    actorId: z.string().min(1).optional(),
  })
  .strict();

export type DomainEventMetadata = z.infer<typeof domainEventMetadataSchema>;

export const domainEventEnvelopeSchema = z
  .object({
    eventId: z.string().uuid(),
    eventName: z.string().min(1),
    occurredAt: z.string().datetime(),
    aggregateType: z.string().min(1),
    aggregateId: z.string().min(1),
    payloadVersion: z.number().int().positive(),
    data: z.unknown(),
    metadata: domainEventMetadataSchema.optional(),
  })
  .strict();

export type DomainEventEnvelope = z.infer<typeof domainEventEnvelopeSchema>;

export type DomainEvent<T = unknown> = Omit<DomainEventEnvelope, 'data'> & {
  data: T;
};

/** Per-listener failure policy for in-process sync delivery. */
export type EventErrorPolicy = 'isolate' | 'throw';

export type EventListener<T = unknown> = (
  event: DomainEvent<T>,
) => void | Promise<void>;

export type SubscribeOptions = {
  /** Stable listener id for unsubscribe / diagnostics. */
  id?: string;
  errorPolicy?: EventErrorPolicy;
};

export type PublishInput<T> = {
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  data: T;
  payloadVersion?: number;
  metadata?: DomainEventMetadata;
  eventId?: string;
  occurredAt?: string;
};

/**
 * Build a validated domain event envelope (assigns eventId / occurredAt when omitted).
 */
export function createDomainEvent<T>(
  input: PublishInput<T>,
): DomainEvent<T> {
  const envelope: DomainEvent<T> = {
    eventId: input.eventId ?? crypto.randomUUID(),
    eventName: input.eventName,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payloadVersion: input.payloadVersion ?? 1,
    data: input.data,
    metadata: input.metadata,
  };
  domainEventEnvelopeSchema.parse(envelope);
  return envelope;
}
