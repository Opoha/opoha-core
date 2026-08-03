import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Marketplace seller account (Phase 7 C-01).
 * OWNER: vendors module — plugins must not alter this table.
 * Distinct from `suppliers` (purchase-order supply). Cross-module FK to
 * `stores.id` only (ADR-0005 / ADR-0010).
 */
@Entity({ name: 'vendors' })
@Index('vendors_store_id_idx', ['storeId'])
export class VendorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable merchant-facing code (e.g. SHOP-A, VEN-01). */
  @Index('vendors_code_uidx', { unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /**
   * Optional store channel this vendor sells through.
   * FK to `stores.id` (cross-module ID reference only).
   */
  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId!: string | null;

  /**
   * Platform commission in basis points (e.g. 1000 = 10%).
   * Foundation only — no escrow/payout automation in Phase 7.
   */
  @Column({ name: 'commission_bps', type: 'integer', default: 0 })
  commissionBps!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'text', nullable: true })
  email!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
