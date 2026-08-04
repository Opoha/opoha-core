import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Payment lifecycle status (core-owned). */
export type PaymentStatus =
  'pending' | 'authorized' | 'captured' | 'refunded' | 'failed' | 'cancelled';

/** OWNER: payment-engine module — plugins must not alter this table. */
@Entity({ name: 'payments' })
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('payments_order_id_idx')
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ name: 'provider_code', type: 'text' })
  providerCode!: string;

  @Column({ type: 'text', default: 'pending' })
  status!: PaymentStatus;

  @Column({ name: 'amount_minor', type: 'bigint' })
  amountMinor!: string;

  @Column({ name: 'currency_code', type: 'text', default: 'USD' })
  currencyCode!: string;

  /** External PSP / provider reference. */
  @Column({ name: 'external_id', type: 'text', nullable: true })
  externalId!: string | null;

  @Index('payments_idempotency_key_uidx', { unique: true })
  @Column({ name: 'idempotency_key', type: 'text', nullable: true })
  idempotencyKey!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'authorized_at', type: 'timestamptz', nullable: true })
  authorizedAt!: Date | null;

  @Column({ name: 'captured_at', type: 'timestamptz', nullable: true })
  capturedAt!: Date | null;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt!: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
