import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { B2bQuoteLineEntity } from './b2b-quote-line.entity';

export const B2B_QUOTE_STATUSES = [
  'draft',
  'submitted',
  'accepted',
  'converted',
  'cancelled',
] as const;

export type B2bQuoteStatus = (typeof B2B_QUOTE_STATUSES)[number];

export function isB2bQuoteStatus(value: string): value is B2bQuoteStatus {
  return (B2B_QUOTE_STATUSES as readonly string[]).includes(value);
}

/**
 * B2B buyer quote / purchase-order foundation.
 * Distinct from supply-module `purchase_orders` (supplier inbound POs).
 * OWNER: b2b module — plugins must not alter this table.
 */
@Entity({ name: 'b2b_quotes' })
@Index('b2b_quotes_company_id_idx', ['companyId'])
@Index('b2b_quotes_store_id_idx', ['storeId'])
@Index('b2b_quotes_status_idx', ['status'])
export class B2bQuoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  /** Store channel copied from company at create. FK to `stores.id`. */
  @Column({ name: 'store_id', type: 'uuid' })
  storeId!: string;

  /** Buyer customer who created the quote. FK to `customers.id`. */
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  /**
   * Optional buyer purchase-order number (external reference).
   * Not the supply-module PO id.
   */
  @Column({ name: 'po_number', type: 'text', nullable: true })
  poNumber!: string | null;

  @Column({ type: 'text', default: 'draft' })
  status!: B2bQuoteStatus;

  @Column({ name: 'currency_code', type: 'text', default: 'USD' })
  currencyCode!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Set when converted to a draft B2B order. FK to `orders.id`. */
  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId!: string | null;

  @OneToMany(() => B2bQuoteLineEntity, (line) => line.quote, {
    cascade: true,
  })
  lines!: B2bQuoteLineEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
