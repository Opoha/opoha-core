import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Automatic / catalog discount rule kinds. */
export type DiscountRuleKind =
  'percentage' | 'fixed_amount' | 'free_shipping' | 'bxgy' | 'automatic';

/**
 * Automatic discount rule (Phase 2 D-02).
 * OWNER: promotions-engine module — plugins must not alter this table.
 * Coupon codes live on {@link CouponEntity}; this table is for non-code rules.
 */
@Entity({ name: 'discount_rules' })
export class DiscountRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable rule code for admin / provider reference. */
  @Index('discount_rules_code_uidx', { unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** percentage | fixed_amount | free_shipping | bxgy | automatic */
  @Column({ type: 'text' })
  kind!: DiscountRuleKind;

  /**
   * Percentage discount in basis points (1000 = 10.00%).
   * Used when kind = percentage.
   */
  @Column({ name: 'value_bps', type: 'integer', nullable: true })
  valueBps!: number | null;

  /**
   * Fixed discount in minor units.
   * Used when kind = fixed_amount.
   */
  @Column({ name: 'amount_minor', type: 'bigint', nullable: true })
  amountMinor!: string | null;

  /** Currency for fixed_amount rules. */
  @Column({ name: 'currency_code', type: 'text', nullable: true })
  currencyCode!: string | null;

  /** Minimum merchandise subtotal (minor units) to qualify. */
  @Column({ name: 'min_subtotal_minor', type: 'bigint', nullable: true })
  minSubtotalMinor!: string | null;

  /** Higher priority wins when multiple automatic rules match. */
  @Column({ type: 'integer', default: 0 })
  priority!: number;

  /** When true, may combine with other automatic rules (D-03+). */
  @Column({ type: 'boolean', default: false })
  stackable!: boolean;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt!: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Rule conditions (e.g. BXGY buy/get SKUs, customer segments).
   * Phase 4 E-03: may include `segmentIds` / `segmentCodes` to restrict
   * automatic discounts to matching customer segments.
   * Shape is provider-interpreted; core stores opaquely.
   */
  @Column({ type: 'jsonb', nullable: true })
  conditions!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
