import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CartLineEntity } from './cart-line.entity';

export type CartStatus = 'open' | 'locked' | 'converted' | 'abandoned';

/** OWNER: order module — plugins must not alter this table. */
@Entity({ name: 'carts' })
export class CartEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Optional buyer; null = anonymous / staff-managed cart. */
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId!: string | null;

  @Column({ type: 'text', default: 'open' })
  status!: CartStatus;

  @Column({ name: 'currency_code', type: 'text', default: 'USD' })
  currencyCode!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => CartLineEntity, (line) => line.cart)
  lines!: CartLineEntity[];
}
