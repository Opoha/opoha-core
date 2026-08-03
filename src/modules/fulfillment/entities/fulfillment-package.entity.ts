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
@Entity({ name: 'fulfillment_packages' })
export class FulfillmentPackageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'fulfillment_id', type: 'uuid' })
  @Index('fulfillment_packages_fulfillment_id_idx')
  fulfillmentId!: string;

  @ManyToOne(() => FulfillmentEntity, (fulfillment) => fulfillment.packages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fulfillment_id' })
  fulfillment!: FulfillmentEntity;

  @Column({ name: 'tracking_number', type: 'text', nullable: true })
  trackingNumber!: string | null;

  @Column({ name: 'carrier_code', type: 'text', nullable: true })
  carrierCode!: string | null;

  /** Label URL from ShippingMethodProvider.createLabel (D-04). */
  @Column({ name: 'label_url', type: 'text', nullable: true })
  labelUrl!: string | null;

  @Column({ name: 'weight_grams', type: 'integer', nullable: true })
  weightGrams!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
