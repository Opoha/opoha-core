import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Customer-specific (company) price list item (Phase 5 F-04).
 * OWNER: b2b module — plugins must not alter this table.
 * Cross-module FKs to `companies.id` (same module) and `product_variants.id`
 * by id only (ADR-0005 / ADR-0010) — no TypeORM relation into catalog.
 */
@Entity({ name: 'company_price_list_items' })
@Unique('company_price_list_items_company_variant_key', ['companyId', 'variantId'])
@Index('company_price_list_items_company_id_idx', ['companyId'])
export class CompanyPriceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  /** Product variant id. FK to `product_variants.id`. */
  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  /** Negotiated price in minor units; same currency as the variant. */
  @Column({ name: 'price_minor', type: 'bigint' })
  priceMinor!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
