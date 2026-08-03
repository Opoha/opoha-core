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

import { StockTransferEntity } from './stock-transfer.entity';

/** OWNER: inventory module — plugins must not alter this table. */
@Entity({ name: 'stock_transfer_lines' })
export class StockTransferLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'transfer_id', type: 'uuid' })
  @Index('stock_transfer_lines_transfer_id_idx')
  transferId!: string;

  @ManyToOne(() => StockTransferEntity, (transfer) => transfer.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transfer_id' })
  transfer!: StockTransferEntity;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
