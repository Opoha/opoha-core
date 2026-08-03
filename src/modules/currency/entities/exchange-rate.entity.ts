import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Manual (or provider-written) FX rate: 1 `fromCurrencyCode` = `rate` × `toCurrencyCode`.
 * OWNER: currency module — plugins must not alter this table (ADR-0005 / ADR-0010).
 * Provider plugins write via core public APIs only (D-04).
 */
@Entity({ name: 'exchange_rates' })
@Unique('exchange_rates_from_to_key', ['fromCurrencyCode', 'toCurrencyCode'])
@Index('exchange_rates_from_currency_idx', ['fromCurrencyCode'])
@Index('exchange_rates_to_currency_idx', ['toCurrencyCode'])
export class ExchangeRateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** ISO 4217 source currency (e.g. settlement). */
  @Column({ name: 'from_currency_code', type: 'text' })
  fromCurrencyCode!: string;

  /** ISO 4217 target currency (e.g. display). */
  @Column({ name: 'to_currency_code', type: 'text' })
  toCurrencyCode!: string;

  /**
   * Multiply amount in `from` by this rate to get amount in `to`.
   * Must be finite and greater than 0.
   */
  @Column({ type: 'double precision' })
  rate!: number;

  /**
   * Rate provenance. Core manual CRUD uses `manual`; FX plugins (D-04) may set
   * other values (e.g. provider id) without owning this table.
   */
  @Column({ type: 'text', default: 'manual' })
  source!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
