import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * B2B company account (Phase 5 F-01).
 * OWNER: b2b module — plugins must not alter this table.
 * Cross-module FK to `stores.id` only (ADR-0005 / ADR-0010).
 */
@Entity({ name: 'companies' })
@Index('companies_store_id_idx', ['storeId'])
export class CompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Store channel this company buys from. FK to `stores.id`. */
  @Column({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  @Column({ type: 'text' })
  name!: string;

  /**
   * Optional credit limit in minor units (F-04 will enforce).
   * Null = no limit configured yet.
   */
  @Column({ name: 'credit_limit_minor', type: 'bigint', nullable: true })
  creditLimitMinor!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
