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

import { CategoryEntity } from './category.entity';

/**
 * OWNER: catalog module — plugins must not alter this table.
 *
 * Locale-specific category fields (Phase 5 C-01).
 * Base `categories` row holds the default-locale content; this table stores
 * overrides for additional BCP 47 locales.
 */
@Entity({ name: 'category_translations' })
@Unique('category_translations_category_id_locale_key', ['categoryId', 'locale'])
@Index('category_translations_locale_idx', ['locale'])
export class CategoryTranslationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => CategoryEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category!: CategoryEntity;

  /** BCP 47-like locale tag (e.g. en-US, th-TH). */
  @Column({ type: 'text' })
  locale!: string;

  @Column({ type: 'text' })
  name!: string;

  /** Optional localized slug; null → fall back to base category slug. */
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
