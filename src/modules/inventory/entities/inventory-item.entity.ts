import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** OWNER: inventory module — plugins must not alter this table. */
@Entity({ name: 'inventory_items' })
export class InventoryItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Catalog product variant (FK enforced in migration). */
  @Column({ name: 'variant_id', type: 'uuid', unique: true })
  variantId!: string;

  @Column({ name: 'quantity_on_hand', type: 'integer', default: 0 })
  quantityOnHand!: number;

  @Column({ name: 'quantity_reserved', type: 'integer', default: 0 })
  quantityReserved!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
