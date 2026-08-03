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

import { ReturnEntity } from './return.entity';

/** OWNER: returns module — plugins must not alter this table. */
@Entity({ name: 'return_lines' })
export class ReturnLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'return_id', type: 'uuid' })
  @Index('return_lines_return_id_idx')
  returnId!: string;

  @ManyToOne(() => ReturnEntity, (rma) => rma.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'return_id' })
  rma!: ReturnEntity;

  @Column({ name: 'order_line_id', type: 'uuid' })
  @Index('return_lines_order_line_id_idx')
  orderLineId!: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
