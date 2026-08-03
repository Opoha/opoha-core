import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { FulfillmentMode } from './fulfillment-mode';
import { ProductVariantEntity } from './product-variant.entity';

/**
 * OWNER: catalog module — plugins must not alter this table.
 *
 * Store scope (Phase 5 B-01):
 * - `storeId` null → shared catalog (visible to all stores)
 * - `storeId` set → store-owned (isolated to that store)
 * Slug uniqueness is enforced by partial DB indexes (see CatalogStoreScope migration).
 */
@Entity({ name: 'products' })
@Index('products_store_id_idx', ['storeId'])
@Index('products_fulfillment_mode_idx', ['fulfillmentMode'])
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Default fulfillment mode for new variants (Phase 7 A-02).
   * Variant `fulfillmentMode` is authoritative at purchase.
   */
  @Column({ name: 'fulfillment_mode', type: 'text', default: 'physical' })
  fulfillmentMode!: FulfillmentMode;

  /**
   * Owning store. Null = shared across stores.
   * FK to `stores.id` (cross-module ID reference only).
   */
  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => ProductVariantEntity, (variant) => variant.product)
  variants!: ProductVariantEntity[];
}
