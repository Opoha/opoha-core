import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Per-store display vs settlement currency configuration (Phase 5 D-01).
 * OWNER: currency module — plugins must not alter this table.
 * Cross-module FK to `stores.id` only (ADR-0005 / ADR-0010).
 */
@Entity({ name: 'store_currency_config' })
export class StoreCurrencyConfigEntity {
  /** Store channel id (PK). FK to `stores.id`. */
  @PrimaryColumn({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  /**
   * Currency used for payment capture / settlement (ISO 4217).
   * Cart line prices and order totals settle in this currency.
   */
  @Column({ name: 'settlement_currency_code', type: 'text' })
  settlementCurrencyCode!: string;

  /**
   * Primary customer-facing display currency (ISO 4217).
   * May differ from settlement when FX conversion is configured (D-02/D-03).
   */
  @Column({ name: 'display_currency_code', type: 'text' })
  displayCurrencyCode!: string;

  /**
   * Additional allowed display currencies (ISO 4217 codes).
   * The primary `displayCurrencyCode` is always treated as enabled.
   */
  @Column({
    name: 'enabled_display_currencies',
    type: 'jsonb',
    default: [],
  })
  enabledDisplayCurrencies!: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
