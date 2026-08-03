import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ProductEntity } from './product.entity';

/**
 * Links a files-module `fileId` to a product (metadata only; blobs via storage plugins).
 * OWNER: catalog module — plugins must not alter this table.
 */
@Entity({ name: 'product_media' })
export class ProductMediaEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: ProductEntity;

  /** Soft reference to `files.id` (files module ownership; no cross-owner FK). */
  @Column({ name: 'file_id', type: 'uuid' })
  fileId!: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'alt_text', type: 'text', nullable: true })
  altText!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
