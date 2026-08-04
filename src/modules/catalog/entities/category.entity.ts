import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * OWNER: catalog module — plugins must not alter this table.
 *
 * Store scope:
 * - `storeId` null → shared catalog (visible to all stores)
 * - `storeId` set → store-owned (isolated to that store)
 */
@Entity({ name: 'categories' })
@Index('categories_store_id_idx', ['storeId'])
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /**
   * Owning store. Null = shared across stores.
   * FK to `stores.id` (cross-module ID reference only).
   */
  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId!: string | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => CategoryEntity, (category) => category.children, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent!: CategoryEntity | null;

  @OneToMany(() => CategoryEntity, (category) => category.parent)
  children!: CategoryEntity[];

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
