import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CartLineEntity } from './cart-line.entity';

export type CartStatus = 'open' | 'locked' | 'converted' | 'abandoned';

/**
 * OWNER: order module — plugins must not alter this table.
 *
 * Store scope: every cart is bound to a store channel.
 * Line items must be products visible to that store (shared or owned).
 */
@Entity({ name: 'carts' })
@Index('carts_store_id_idx', ['storeId'])
export class CartEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Owning store channel. FK to `stores.id` (cross-module ID reference only).
   */
  @Column({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  /** Optional buyer; null = anonymous / staff-managed cart. */
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId!: string | null;

  /**
 * Optional B2B company for approval workflow.
   * FK to `companies.id` (cross-module ID reference only).
   */
  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId!: string | null;

  @Column({ type: 'text', default: 'open' })
  status!: CartStatus;

  @Column({ name: 'currency_code', type: 'text', default: 'USD' })
  currencyCode!: string;

 /** Selected ShippingMethodProvider.code. */
  @Column({ name: 'shipping_method_code', type: 'text', nullable: true })
  shippingMethodCode!: string | null;

 /** Selected rate/service code from quoteRates. */
  @Column({ name: 'shipping_rate_code', type: 'text', nullable: true })
  shippingRateCode!: string | null;

  /** Quoted shipping amount in minor units for the selected rate. */
  @Column({ name: 'shipping_minor', type: 'bigint', default: '0' })
  shippingMinor!: string;

  /**
   * Whether catalog prices include tax (`inclusive`) or exclude it (`exclusive`).
   * Drives TaxEngine.calculate + checkout totals.
   */
  @Column({ name: 'tax_pricing_mode', type: 'text', default: 'exclusive' })
  taxPricingMode!: 'inclusive' | 'exclusive';

  /** ISO 3166-1 alpha-2 destination for tax jurisdiction matching. */
  @Column({ name: 'tax_country_code', type: 'text', nullable: true })
  taxCountryCode!: string | null;

  @Column({ name: 'tax_postal_code', type: 'text', nullable: true })
  taxPostalCode!: string | null;

  @Column({ name: 'tax_province', type: 'text', nullable: true })
  taxProvince!: string | null;

  /** Optional TaxProvider.code override when multiple providers are active. */
  @Column({ name: 'tax_provider_code', type: 'text', nullable: true })
  taxProviderCode!: string | null;

  /** Last calculated tax amount in minor units (updated at prepareCheckout). */
  @Column({ name: 'tax_minor', type: 'bigint', default: '0' })
  taxMinor!: string;

 /** Optional coupon code for PromotionsEngine. */
  @Column({ name: 'coupon_code', type: 'text', nullable: true })
  couponCode!: string | null;

  /** Last calculated discount amount in minor units (updated at prepareCheckout). */
  @Column({ name: 'discount_minor', type: 'bigint', default: '0' })
  discountMinor!: string;

 /** Optional gift card code for GiftCardService redeem. */
  @Column({ name: 'gift_card_code', type: 'text', nullable: true })
  giftCardCode!: string | null;

  /** Last calculated gift card apply amount in minor units. */
  @Column({ name: 'gift_card_minor', type: 'bigint', default: '0' })
  giftCardMinor!: string;

 /** Loyalty points the buyer intends to redeem at checkout. */
  @Column({ name: 'loyalty_points_to_redeem', type: 'integer', default: 0 })
  loyaltyPointsToRedeem!: number;

  /** Last calculated loyalty redeem amount in minor units. */
  @Column({ name: 'loyalty_minor', type: 'bigint', default: '0' })
  loyaltyMinor!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => CartLineEntity, (line) => line.cart)
  lines!: CartLineEntity[];
}
