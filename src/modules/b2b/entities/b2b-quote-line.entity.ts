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

import { B2bQuoteEntity } from './b2b-quote.entity';

/**
 * Line on a B2B buyer quote.
 * OWNER: b2b module — plugins must not alter this table.
 * Cross-module FK to `product_variants.id` by id only.
 */
@Entity({ name: 'b2b_quote_lines' })
@Index('b2b_quote_lines_quote_id_idx', ['quoteId'])
export class B2bQuoteLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'quote_id', type: 'uuid' })
  quoteId!: string;

  @ManyToOne(() => B2bQuoteEntity, (quote) => quote.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quote_id' })
  quote!: B2bQuoteEntity;

  /** Product variant id. FK to `product_variants.id`. */
  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  /** Negotiated / quoted unit price in minor units. */
  @Column({ name: 'unit_price_minor', type: 'bigint' })
  unitPriceMinor!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
