import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** OWNER: loyalty module — plugins must not alter this table. */
@Entity({ name: 'loyalty_accounts' })
export class LoyaltyAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customer_id', type: 'uuid', unique: true })
  @Index('loyalty_accounts_customer_id_idx')
  customerId!: string;

  @Column({ name: 'points_balance', type: 'integer', default: 0 })
  pointsBalance!: number;

  @Column({ name: 'lifetime_points_earned', type: 'integer', default: 0 })
  lifetimePointsEarned!: number;

  @Column({ name: 'lifetime_points_redeemed', type: 'integer', default: 0 })
  lifetimePointsRedeemed!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
