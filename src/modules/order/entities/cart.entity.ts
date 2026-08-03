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

  /** Selected ShippingMethodProvider.code (Phase 2 B-02). */
  @Column({ name: 'shipping_method_code', type: 'text', nullable: true })
  shippingMethodCode!: string | null;

  /** Selected rate/service code from quoteRates (Phase 2 B-02). */
  @Column({ name: 'shipping_rate_code', type: 'text', nullable: true })
  shippingRateCode!: string | null;

  /** Quoted shipping amount in minor units for the selected rate. */
  @Column({ name: 'shipping_minor', type: 'bigint', default: '0' })
  shippingMinor!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => CartLineEntity, (line) => line.cart)
  lines!: CartLineEntity[];
}
