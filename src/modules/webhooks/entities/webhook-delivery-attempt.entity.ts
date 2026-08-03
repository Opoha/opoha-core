import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { WebhookDeliveryStatus } from '../webhook-status';

/**
 * Outbound webhook delivery attempt / log row (Phase 8 D-01).
 * OWNER: webhooks module — plugins must not alter this table.
 */
@Entity({ name: 'webhook_delivery_attempts' })
@Index('webhook_delivery_attempts_endpoint_id_idx', ['endpointId'])
@Index('webhook_delivery_attempts_status_idx', ['status'])
@Index('webhook_delivery_attempts_next_attempt_at_idx', ['nextAttemptAt'])
export class WebhookDeliveryAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'endpoint_id', type: 'uuid' })
  endpointId!: string;

  @Column({ name: 'event_name', type: 'text' })
  eventName!: string;

  /** Domain event envelope id (for idempotency / correlation). */
  @Column({ name: 'event_id', type: 'text' })
  eventId!: string;

  /** JSON body posted to the endpoint. */
  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'text', default: 'pending' })
  status!: WebhookDeliveryStatus;

  @Column({ type: 'integer', default: 1 })
  attempt!: number;

  /** When status is pending/failed, next time the worker may retry. */
  @Column({ name: 'next_attempt_at', type: 'timestamptz', nullable: true })
  nextAttemptAt!: Date | null;

  @Column({ name: 'response_status', type: 'integer', nullable: true })
  responseStatus!: number | null;

  /** Truncated response body for diagnostics. */
  @Column({ name: 'response_body', type: 'text', nullable: true })
  responseBody!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  /** Signature header value sent with the request (sha256=<hex>). */
  @Column({ type: 'text', nullable: true })
  signature!: string | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
