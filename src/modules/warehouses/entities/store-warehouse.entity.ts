import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Store ↔ warehouse allow-list.
 * OWNER: warehouses module — plugins must not alter this table.
 * Cross-module FK to `stores.id` only; warehouse FK within warehouses (ADR-0005 / ADR-0010).
 */
@Entity({ name: 'store_warehouses' })
export class StoreWarehouseEntity {
  /** Store channel id. FK to `stores.id`. */
  @PrimaryColumn({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  /** Warehouse id. FK to `warehouses.id`. */
  @PrimaryColumn({ name: 'warehouse_id', type: 'uuid' })
  warehouseId!: string;

  /**
   * Preferred allocation / reservation warehouse for the store.
   * At most one primary per store (enforced in service + partial unique index).
   */
  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
