import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { LoyaltyTransactionType } from '../loyalty-status';
import { LoyaltyAccountEntity } from './loyalty-account.entity';

/**
 * OWNER: loyalty module — plugins must not alter this table.
 * Append-only ledger; `balanceAfter` is the account points balance post-transaction.
 */
@Entity({ name: 'loyalty_transactions' })
export class LoyaltyTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'account_id', type: 'uuid' })
  @Index('loyalty_transactions_account_id_idx')
  accountId!: string;

  @ManyToOne(() => LoyaltyAccountEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: LoyaltyAccountEntity;

  @Column({ name: 'customer_id', type: 'uuid' })
  @Index('loyalty_transactions_customer_id_idx')
  customerId!: string;

  @Column({ type: 'text' })
  type!: LoyaltyTransactionType;

  @Column({ type: 'integer' })
  points!: number;

  @Column({ name: 'balance_after', type: 'integer' })
  balanceAfter!: number;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  @Index('loyalty_transactions_order_id_idx')
  orderId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
