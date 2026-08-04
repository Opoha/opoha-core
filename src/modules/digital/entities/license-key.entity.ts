import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { DigitalLicenseKeyStatus } from '../digital-status';

/**
 * License key issued for a digital order line.
 * OWNER: digital module — plugins must not alter this table.
 * Cross-module FKs (ID only): orders, order_lines, product_variants, customers.
 */
@Entity({ name: 'digital_license_keys' })
@Index('digital_license_keys_order_id_idx', ['orderId'])
@Index('digital_license_keys_customer_id_idx', ['customerId'])
@Index('digital_license_keys_variant_id_idx', ['variantId'])
export class DigitalLicenseKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Customer-facing license string (unique). */
  @Index('digital_license_keys_key_uidx', { unique: true })
  @Column({ name: 'license_key', type: 'text' })
  licenseKey!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ name: 'order_line_id', type: 'uuid' })
  orderLineId!: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId!: string | null;

  @Column({ type: 'text', default: 'active' })
  @Index('digital_license_keys_status_idx')
  status!: DigitalLicenseKeyStatus;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
