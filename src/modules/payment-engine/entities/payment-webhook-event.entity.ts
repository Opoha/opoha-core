import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Deduped provider webhook events.
 * OWNER: payment-engine — plugins must not alter this table.
 */
@Entity({ name: 'payment_webhook_events' })
@Index('payment_webhook_events_provider_event_uidx', ['providerCode', 'externalEventId'], {
  unique: true,
})
export class PaymentWebhookEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'provider_code', type: 'text' })
  providerCode!: string;

  /** Provider-supplied event id used for idempotent processing. */
  @Column({ name: 'external_event_id', type: 'text' })
  externalEventId!: string;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId!: string | null;

  @Column({ type: 'text', default: 'received' })
  status!: 'received' | 'processed' | 'ignored' | 'failed';

  @Column({ type: 'text', nullable: true })
  action!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload!: unknown | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;
}
