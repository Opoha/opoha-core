import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Outbound webhook endpoint subscription.
 * OWNER: webhooks module — plugins must not alter this table.
 */
@Entity({ name: 'webhook_endpoints' })
export class WebhookEndpointEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable unique key for admin / references. */
  @Index('webhook_endpoints_code_uidx', { unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  /** HTTPS (or http for local/dev) destination URL. */
  @Column({ type: 'text' })
  url!: string;

  /** HMAC-SHA256 signing secret (merchant-facing; never log). */
  @Column({ type: 'text' })
  secret!: string;

  /** Domain event names this endpoint receives (empty = none). */
  @Column({ name: 'event_names', type: 'jsonb', default: [] })
  eventNames!: string[];

  @Column({ type: 'boolean', default: true })
  @Index('webhook_endpoints_enabled_idx')
  enabled!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
