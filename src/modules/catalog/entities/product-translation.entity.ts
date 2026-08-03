import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { ProductEntity } from './product.entity';

/**
 * OWNER: catalog module — plugins must not alter this table.
 *
 * Locale-specific product fields (Phase 5 C-01).
 * Base `products` row holds the default-locale content; this table stores
 * overrides for additional BCP 47 locales.
 */
@Entity({ name: 'product_translations' })
@Unique('product_translations_product_id_locale_key', ['productId', 'locale'])
@Index('product_translations_locale_idx', ['locale'])
export class ProductTranslationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: ProductEntity;

  /** BCP 47-like locale tag (e.g. en-US, th-TH). */
  @Column({ type: 'text' })
  locale!: string;

  @Column({ type: 'text' })
  name!: string;

  /** Optional localized slug; null → fall back to base product slug. */
  @Column({ type: 'text', nullable: true })
  slug!: string | null;

  /** Optional localized description; null → fall back to base description. */
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
