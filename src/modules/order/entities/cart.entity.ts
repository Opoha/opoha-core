import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CartLineEntity } from './cart-line.entity';

export type CartStatus = 'open' | 'locked' | 'converted' | 'abandoned';

/** OWNER: order module — plugins must not alter this table. */
@Entity({ name: 'carts' })
export class CartEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Optional buyer; null = anonymous / staff-managed cart. */
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId!: string | null;

  @Column({ type: 'text', default: 'open' })
  status!: CartStatus;

  @Column({ name: 'currency_code', type: 'text', default: 'USD' })
  currencyCode!: string;

  /** Selected ShippingMethodProvider.code (Phase 2 B-02). */
  @Column({ name: 'shipping_method_code', type: 'text', nullable: true })
  shippingMethodCode!: string | null;

  /** Selected rate/service code from quoteRates (Phase 2 B-02). */
  @Column({ name: 'shipping_rate_code', type: 'text', nullable: true })
  shippingRateCode!: string | null;

  /** Quoted shipping amount in minor units for the selected rate. */
  @Column({ name: 'shipping_minor', type: 'bigint', default: '0' })
  shippingMinor!: string;

  /**
   * Whether catalog prices include tax (`inclusive`) or exclude it (`exclusive`).
   * Phase 2 C-03 — drives TaxEngine.calculate + checkout totals.
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

  /** Optional coupon code for PromotionsEngine (Phase 2 D-01). */
  @Column({ name: 'coupon_code', type: 'text', nullable: true })
  couponCode!: string | null;

  /** Last calculated discount amount in minor units (updated at prepareCheckout). */
  @Column({ name: 'discount_minor', type: 'bigint', default: '0' })
  discountMinor!: string;

  /** Optional gift card code for GiftCardService redeem (Phase 4 C-02). */
  @Column({ name: 'gift_card_code', type: 'text', nullable: true })
  giftCardCode!: string | null;

  /** Last calculated gift card apply amount in minor units. */
  @Column({ name: 'gift_card_minor', type: 'bigint', default: '0' })
  giftCardMinor!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => CartLineEntity, (line) => line.cart)
  lines!: CartLineEntity[];
}
