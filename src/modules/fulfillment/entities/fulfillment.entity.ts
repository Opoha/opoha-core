import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { FulfillmentLineEntity } from './fulfillment-line.entity';
import { FulfillmentPackageEntity } from './fulfillment-package.entity';

export type FulfillmentStatus = 'pending' | 'picked' | 'packed' | 'shipped' | 'cancelled';

/** OWNER: fulfillment module — plugins must not alter this table. */
@Entity({ name: 'fulfillments' })
export class FulfillmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  @Index('fulfillments_order_id_idx')
  orderId!: string;

  @Column({ name: 'warehouse_id', type: 'uuid' })
  @Index('fulfillments_warehouse_id_idx')
  warehouseId!: string;

  @Column({ type: 'text', default: 'pending' })
  @Index('fulfillments_status_idx')
  status!: FulfillmentStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Set on ship (or copied from a package / explicit input). */
  @Column({ name: 'tracking_number', type: 'text', nullable: true })
  trackingNumber!: string | null;

  @Column({ name: 'picked_at', type: 'timestamptz', nullable: true })
  pickedAt!: Date | null;

  @Column({ name: 'packed_at', type: 'timestamptz', nullable: true })
  packedAt!: Date | null;

  @Column({ name: 'shipped_at', type: 'timestamptz', nullable: true })
  shippedAt!: Date | null;

  @OneToMany(() => FulfillmentLineEntity, (line) => line.fulfillment, {
    cascade: true,
  })
  lines!: FulfillmentLineEntity[];

  @OneToMany(() => FulfillmentPackageEntity, (pkg) => pkg.fulfillment, {
    cascade: true,
  })
  packages!: FulfillmentPackageEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
