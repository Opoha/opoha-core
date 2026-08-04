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

import { TaxClassEntity } from './tax-class.entity';

/** OWNER: tax-engine module — plugins must not alter this table. */
@Entity({ name: 'tax_rules' })
export class TaxRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('tax_rules_tax_class_id_idx')
  @Column({ name: 'tax_class_id', type: 'uuid' })
  taxClassId!: string;

  @Column({ type: 'text' })
  name!: string;

  /** ISO 3166-1 alpha-2 country code for jurisdiction matching. */
  @Index('tax_rules_country_code_idx')
  @Column({ name: 'country_code', type: 'text' })
  countryCode!: string;

  /** Optional province / state / region filter. */
  @Column({ type: 'text', nullable: true })
  province!: string | null;

  /** Optional postal / ZIP filter (exact or provider-interpreted). */
  @Column({ name: 'postal_code', type: 'text', nullable: true })
  postalCode!: string | null;

  /**
   * Tax rate in basis points (1000 = 10.00%).
   * Matches {@link TaxLineResult.rateBps}.
   */
  @Column({ name: 'rate_bps', type: 'integer' })
  rateBps!: number;

 /** Higher priority wins when multiple rules match (provider /). */
  @Column({ type: 'integer', default: 0 })
  priority!: number;

  @Column({ name: 'applies_to_shipping', type: 'boolean', default: false })
  appliesToShipping!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(() => TaxClassEntity, (taxClass) => taxClass.rules, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tax_class_id' })
  taxClass!: TaxClassEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
