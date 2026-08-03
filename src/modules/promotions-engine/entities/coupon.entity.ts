import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Coupon discount kinds stored on core-owned coupons. */
export type CouponKind = 'percentage' | 'fixed_amount' | 'free_shipping';

/**
 * Merchant coupon code (Phase 2 D-02).
 * OWNER: promotions-engine module — plugins must not alter this table.
 */
@Entity({ name: 'coupons' })
export class CouponEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Customer-facing code (unique; normalize to uppercase at write time in D-03+). */
  @Index('coupons_code_uidx', { unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** percentage | fixed_amount | free_shipping */
  @Column({ type: 'text' })
  kind!: CouponKind;

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

  /** Currency for fixed_amount coupons. */
  @Column({ name: 'currency_code', type: 'text', nullable: true })
  currencyCode!: string | null;

  /** Minimum merchandise subtotal (minor units) required to redeem. */
  @Column({ name: 'min_subtotal_minor', type: 'bigint', nullable: true })
  minSubtotalMinor!: string | null;

  /** Global redemption cap; null = unlimited. */
  @Column({ name: 'max_uses', type: 'integer', nullable: true })
  maxUses!: number | null;

  /** Per-customer redemption cap; null = unlimited. */
  @Column({ name: 'max_uses_per_customer', type: 'integer', nullable: true })
  maxUsesPerCustomer!: number | null;

  @Column({ name: 'usage_count', type: 'integer', default: 0 })
  usageCount!: number;

  @Column({ type: 'integer', default: 0 })
  priority!: number;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt!: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Opaque metadata. Phase 4 E-03: may include `segmentIds` / `segmentCodes`
   * to restrict redemption to matching customer segments.
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
