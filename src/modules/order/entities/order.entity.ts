import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { OrderStatus } from './order-status';
import { OrderLineEntity } from './order-line.entity';

/** OWNER: order module — plugins must not alter this table. */
@Entity({ name: 'orders' })
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId!: string | null;

  /** Source cart when placed via checkout (D-04). */
  @Column({ name: 'cart_id', type: 'uuid', nullable: true })
  cartId!: string | null;

  @Column({ type: 'text', default: 'pending' })
  status!: OrderStatus;

  @Column({ name: 'currency_code', type: 'text', default: 'USD' })
  currencyCode!: string;

  @Column({ name: 'subtotal_minor', type: 'bigint', default: '0' })
  subtotalMinor!: string;

  /** Tax stub — always 0 in Phase 1 (no tax provider). */
  @Column({ name: 'tax_minor', type: 'bigint', default: '0' })
  taxMinor!: string;

  /** Shipping stub — set by shipping engine later. */
  @Column({ name: 'shipping_minor', type: 'bigint', default: '0' })
  shippingMinor!: string;

  @Column({ name: 'total_minor', type: 'bigint', default: '0' })
  totalMinor!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => OrderLineEntity, (line) => line.order)
  lines!: OrderLineEntity[];
}
