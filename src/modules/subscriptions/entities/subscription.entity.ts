import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { SubscriptionStatus } from '../subscription-status';

/**
 * Customer subscription schedule state (Phase 7 E-01).
 * OWNER: subscriptions module — plugins must not alter this table.
 * Cross-module FKs (ID only): subscription_plans, customers, stores.
 */
@Entity({ name: 'subscriptions' })
@Index('subscriptions_customer_id_idx', ['customerId'])
@Index('subscriptions_plan_id_idx', ['planId'])
@Index('subscriptions_next_billing_at_idx', ['nextBillingAt'])
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId!: string | null;

  @Column({ type: 'text', default: 'active' })
  @Index('subscriptions_status_idx')
  status!: SubscriptionStatus;

  /** Payment engine provider code used for renewal charges (E-03). */
  @Column({ name: 'payment_provider_code', type: 'text', default: 'manual' })
  paymentProviderCode!: string;

  @Column({ name: 'current_period_start', type: 'timestamptz' })
  currentPeriodStart!: Date;

  @Column({ name: 'current_period_end', type: 'timestamptz' })
  currentPeriodEnd!: Date;

  @Column({ name: 'next_billing_at', type: 'timestamptz' })
  nextBillingAt!: Date;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
