import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Application-level store / brand.
 * OWNER: stores module — plugins must not alter this table.
 * SaaS multi-tenancy is; this is in-deployment store scoping only.
 */
@Entity({ name: 'stores' })
export class StoreEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable merchant-facing code (e.g. DEFAULT, US-WEB). */
  @Index('stores_code_uidx', { unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /** When true, used as fallback when no store context is provided. */
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  /** Default display / settlement currency pointer (ISO 4217). */
  @Column({ name: 'default_currency_code', type: 'text' })
  defaultCurrencyCode!: string;

  /** Default content locale pointer (BCP 47-like, e.g. en-US). */
  @Column({ name: 'default_locale', type: 'text' })
  defaultLocale!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
