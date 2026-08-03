import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { BillingIntervalUnit } from '../subscription-status';

/**
 * Recurring billing plan (Phase 7 E-01).
 * OWNER: subscriptions module — plugins must not alter this table.
 */
@Entity({ name: 'subscription_plans' })
export class SubscriptionPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable merchant-facing code (e.g. PRO-MONTHLY). */
  @Index('subscription_plans_code_uidx', { unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Minor-unit price charged each billing interval (bigint as decimal string). */
  @Column({ name: 'price_minor', type: 'bigint' })
  priceMinor!: string;

  @Column({ name: 'currency_code', type: 'text', default: 'USD' })
  currencyCode!: string;

  @Column({ name: 'billing_interval_unit', type: 'text', default: 'month' })
  billingIntervalUnit!: BillingIntervalUnit;

  @Column({ name: 'billing_interval_count', type: 'integer', default: 1 })
  billingIntervalCount!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
