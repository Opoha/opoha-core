import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TaxRuleEntity } from './tax-rule.entity';

/** OWNER: tax-engine module — plugins must not alter this table. */
@Entity({ name: 'tax_classes' })
export class TaxClassEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable code referenced by catalog lines / {@link TaxCalculateLineItem.taxClassCode}. */
  @Index('tax_classes_code_uidx', { unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => TaxRuleEntity, (rule) => rule.taxClass)
  rules!: TaxRuleEntity[];
}
