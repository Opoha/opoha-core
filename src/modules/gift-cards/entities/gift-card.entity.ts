import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { GiftCardStatus } from '../gift-card-status';

/** OWNER: gift-cards module — plugins must not alter this table. */
@Entity({ name: 'gift_cards' })
export class GiftCardEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  @Index('gift_cards_code_idx')
  code!: string;

  @Column({ type: 'text', default: 'active' })
  @Index('gift_cards_status_idx')
  status!: GiftCardStatus;

  @Column({ name: 'initial_balance_minor', type: 'bigint' })
  initialBalanceMinor!: string;

  @Column({ name: 'balance_minor', type: 'bigint' })
  balanceMinor!: string;

  @Column({ name: 'currency_code', type: 'text' })
  currencyCode!: string;

  /** Recipient customer, if known at issue/purchase time. */
  @Column({ name: 'issued_to_customer_id', type: 'uuid', nullable: true })
  @Index('gift_cards_issued_to_customer_id_idx')
  issuedToCustomerId!: string | null;

  /** Customer who self-purchased the card (purchase path only). */
  @Column({ name: 'purchased_by_customer_id', type: 'uuid', nullable: true })
  purchasedByCustomerId!: string | null;

  /** Order that paid for this card, when purchased through checkout. */
  @Column({ name: 'purchase_order_id', type: 'uuid', nullable: true })
  purchaseOrderId!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
