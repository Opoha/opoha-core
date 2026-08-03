import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** OWNER: inventory module — plugins must not alter this table. */
@Entity({ name: 'inventory_items' })
@Index('inventory_items_variant_warehouse_uidx', ['variantId', 'warehouseId'], {
  unique: true,
})
export class InventoryItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Catalog product variant (FK enforced in migration). */
  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  /** Warehouse / location (FK to warehouses; enforced in migration). */
  @Column({ name: 'warehouse_id', type: 'uuid' })
  @Index('inventory_items_warehouse_id_idx')
  warehouseId!: string;

  @Column({ name: 'quantity_on_hand', type: 'integer', default: 0 })
  quantityOnHand!: number;

  @Column({ name: 'quantity_reserved', type: 'integer', default: 0 })
  quantityReserved!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
