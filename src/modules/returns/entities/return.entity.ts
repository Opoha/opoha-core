import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { ReturnResolution, ReturnStatus } from '../return-status';
import { ReturnLineEntity } from './return-line.entity';

/** OWNER: returns module — plugins must not alter this table. */
@Entity({ name: 'returns' })
export class ReturnEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  @Index('returns_order_id_idx')
  orderId!: string;

  /** Warehouse that receives restocked inventory on receive. */
  @Column({ name: 'warehouse_id', type: 'uuid' })
  @Index('returns_warehouse_id_idx')
  warehouseId!: string;

  @Column({ type: 'text', default: 'requested' })
  @Index('returns_status_idx')
  status!: ReturnStatus;

  /** Intended resolution — refund money or exchange goods. */
  @Column({ type: 'text' })
  resolution!: ReturnResolution;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Payment refunded via PaymentEngine (refund path). */
  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId!: string | null;

  /** Stub replacement order created on exchange. */
  @Column({ name: 'replacement_order_id', type: 'uuid', nullable: true })
  replacementOrderId!: string | null;

  @Column({ name: 'refund_amount_minor', type: 'bigint', nullable: true })
  refundAmountMinor!: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @OneToMany(() => ReturnLineEntity, (line) => line.rma, {
    cascade: true,
  })
  lines!: ReturnLineEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
