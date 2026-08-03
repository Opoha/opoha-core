import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { InventoryItemEntity } from './inventory-item.entity';

export type InventoryReservationStatus = 'active' | 'released' | 'committed';

/** OWNER: inventory module — plugins must not alter this table. */
@Entity({ name: 'inventory_reservations' })
export class InventoryReservationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'inventory_item_id', type: 'uuid' })
  inventoryItemId!: string;

  @ManyToOne(() => InventoryItemEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem!: InventoryItemEntity;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'text', default: 'active' })
  status!: InventoryReservationStatus;

  /** Optional external reference (e.g. cart line id). */
  @Column({ type: 'text', nullable: true })
  reference!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
