import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { StockTransferLineEntity } from './stock-transfer-line.entity';

export type StockTransferStatus =
  | 'draft'
  | 'in_transit'
  | 'received'
  | 'cancelled';

/** OWNER: inventory module — plugins must not alter this table. */
@Entity({ name: 'stock_transfers' })
export class StockTransferEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'from_warehouse_id', type: 'uuid' })
  @Index('stock_transfers_from_warehouse_id_idx')
  fromWarehouseId!: string;

  @Column({ name: 'to_warehouse_id', type: 'uuid' })
  @Index('stock_transfers_to_warehouse_id_idx')
  toWarehouseId!: string;

  @Column({ type: 'text', default: 'draft' })
  @Index('stock_transfers_status_idx')
  status!: StockTransferStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'shipped_at', type: 'timestamptz', nullable: true })
  shippedAt!: Date | null;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt!: Date | null;

  @OneToMany(() => StockTransferLineEntity, (line) => line.transfer, {
    cascade: true,
  })
  lines!: StockTransferLineEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
