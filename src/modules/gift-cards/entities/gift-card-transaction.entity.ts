import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { GiftCardTransactionType } from '../gift-card-status';
import { GiftCardEntity } from './gift-card.entity';

/**
 * OWNER: gift-cards module — plugins must not alter this table.
 * Append-only ledger; `balanceAfterMinor` is the card balance post-transaction.
 */
@Entity({ name: 'gift_card_transactions' })
export class GiftCardTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'gift_card_id', type: 'uuid' })
  @Index('gift_card_transactions_gift_card_id_idx')
  giftCardId!: string;

  @ManyToOne(() => GiftCardEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gift_card_id' })
  giftCard!: GiftCardEntity;

  @Column({ type: 'text' })
  type!: GiftCardTransactionType;

  @Column({ name: 'amount_minor', type: 'bigint' })
  amountMinor!: string;

  @Column({ name: 'balance_after_minor', type: 'bigint' })
  balanceAfterMinor!: string;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  @Index('gift_card_transactions_order_id_idx')
  orderId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
