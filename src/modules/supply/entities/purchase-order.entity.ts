import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { PurchaseOrderLineEntity } from './purchase-order-line.entity';

export type PurchaseOrderStatus = 'draft' | 'received' | 'cancelled';

/** OWNER: supply module — plugins must not alter this table. */
@Entity({ name: 'purchase_orders' })
export class PurchaseOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'supplier_id', type: 'uuid' })
  @Index('purchase_orders_supplier_id_idx')
  supplierId!: string;

  /** Warehouse / location that receives stock on PO receive. */
  @Column({ name: 'warehouse_id', type: 'uuid' })
  @Index('purchase_orders_warehouse_id_idx')
  warehouseId!: string;

  @Column({ type: 'text', default: 'draft' })
  @Index('purchase_orders_status_idx')
  status!: PurchaseOrderStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt!: Date | null;

  @OneToMany(() => PurchaseOrderLineEntity, (line) => line.purchaseOrder, {
    cascade: true,
  })
  lines!: PurchaseOrderLineEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
