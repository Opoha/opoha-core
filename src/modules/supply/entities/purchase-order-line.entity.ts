import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { PurchaseOrderEntity } from './purchase-order.entity';

/** OWNER: supply module — plugins must not alter this table. */
@Entity({ name: 'purchase_order_lines' })
export class PurchaseOrderLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'purchase_order_id', type: 'uuid' })
  @Index('purchase_order_lines_purchase_order_id_idx')
  purchaseOrderId!: string;

  @ManyToOne(() => PurchaseOrderEntity, (po) => po.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrderEntity;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  /** Quantity ordered from the supplier. */
  @Column({ type: 'integer' })
  quantity!: number;

  /** Quantity already received into warehouse stock. */
  @Column({ name: 'quantity_received', type: 'integer', default: 0 })
  quantityReceived!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
