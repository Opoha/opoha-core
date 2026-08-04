import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CartEntity } from './cart.entity';

/** OWNER: order module — plugins must not alter this table. */
@Entity({ name: 'cart_lines' })
export class CartLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'cart_id', type: 'uuid' })
  cartId!: string;

  @ManyToOne(() => CartEntity, (cart) => cart.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart!: CartEntity;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  /** Unit price snapshot in minor units at add/update time. */
  @Column({ name: 'unit_price_minor', type: 'bigint' })
  unitPriceMinor!: string;

 /** Inventory reservation created during checkout prepare. */
  @Column({ name: 'reservation_id', type: 'uuid', nullable: true })
  reservationId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
