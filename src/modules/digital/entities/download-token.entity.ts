import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { DigitalDownloadTokenStatus } from '../digital-status';

/**
 * Secure download entitlement issued for a digital order line.
 * OWNER: digital module — plugins must not alter this table.
 * Cross-module FKs (ID only): orders, order_lines, product_variants, customers.
 */
@Entity({ name: 'digital_download_tokens' })
@Index('digital_download_tokens_order_id_idx', ['orderId'])
@Index('digital_download_tokens_customer_id_idx', ['customerId'])
@Index('digital_download_tokens_variant_id_idx', ['variantId'])
export class DigitalDownloadTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Opaque bearer token used in download URLs. */
  @Index('digital_download_tokens_token_uidx', { unique: true })
  @Column({ type: 'text' })
  token!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ name: 'order_line_id', type: 'uuid' })
  orderLineId!: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId!: string | null;

  /**
   * Asset URL the token authorizes (stub path until storage plugin wiring).
   * Never expose raw storage credentials here.
   */
  @Column({ name: 'asset_url', type: 'text' })
  assetUrl!: string;

  @Column({ type: 'text', default: 'active' })
  @Index('digital_download_tokens_status_idx')
  status!: DigitalDownloadTokenStatus;

  @Column({ name: 'max_downloads', type: 'integer', default: 5 })
  maxDownloads!: number;

  @Column({ name: 'download_count', type: 'integer', default: 0 })
  downloadCount!: number;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
