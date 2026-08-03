import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { InventoryItemEntity } from './inventory-item.entity';

/** OWNER: inventory module — plugins must not alter this table. */
@Entity({ name: 'inventory_adjustments' })
export class InventoryAdjustmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'inventory_item_id', type: 'uuid' })
  inventoryItemId!: string;

  @ManyToOne(() => InventoryItemEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem!: InventoryItemEntity;

  /** Signed change applied to quantity_on_hand. */
  @Column({ type: 'integer' })
  delta!: number;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'quantity_on_hand_after', type: 'integer' })
  quantityOnHandAfter!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
