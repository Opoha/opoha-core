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

import type { FulfillmentMode } from './fulfillment-mode';
import { ProductEntity } from './product.entity';

/** OWNER: catalog module — plugins must not alter this table. */
@Entity({ name: 'product_variants' })
@Index('product_variants_fulfillment_mode_idx', ['fulfillmentMode'])
export class ProductVariantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => ProductEntity, (product) => product.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product!: ProductEntity;

  @Column({ type: 'text', unique: true })
  sku!: string;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  /** Price in minor units (e.g. cents) for the catalog default currency. */
  @Column({ name: 'price_minor', type: 'bigint' })
  priceMinor!: string;

  @Column({ name: 'currency_code', type: 'text', default: 'USD' })
  currencyCode!: string;

  /**
 * Authoritative fulfillment mode at purchase.
   * physical | digital | service
   */
  @Column({ name: 'fulfillment_mode', type: 'text', default: 'physical' })
  fulfillmentMode!: FulfillmentMode;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
