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

import { FulfillmentEntity } from './fulfillment.entity';

/** OWNER: fulfillment module — plugins must not alter this table. */
@Entity({ name: 'fulfillment_lines' })
export class FulfillmentLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'fulfillment_id', type: 'uuid' })
  @Index('fulfillment_lines_fulfillment_id_idx')
  fulfillmentId!: string;

  @ManyToOne(() => FulfillmentEntity, (fulfillment) => fulfillment.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fulfillment_id' })
  fulfillment!: FulfillmentEntity;

  @Column({ name: 'order_line_id', type: 'uuid' })
  @Index('fulfillment_lines_order_line_id_idx')
  orderLineId!: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
