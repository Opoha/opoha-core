import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CustomerEntity } from './customer.entity';

/** OWNER: customer module — plugins must not alter this table. */
@Entity({ name: 'customer_addresses' })
export class CustomerAddressEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @ManyToOne(() => CustomerEntity, (customer) => customer.addresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer!: CustomerEntity;

  @Column({ type: 'text', nullable: true })
  label!: string | null;

  @Column({ name: 'first_name', type: 'text' })
  firstName!: string;

  @Column({ name: 'last_name', type: 'text' })
  lastName!: string;

  @Column({ type: 'text', nullable: true })
  company!: string | null;

  @Column({ name: 'line1', type: 'text' })
  line1!: string;

  @Column({ name: 'line2', type: 'text', nullable: true })
  line2!: string | null;

  @Column({ type: 'text' })
  city!: string;

  @Column({ type: 'text', nullable: true })
  province!: string | null;

  @Column({ name: 'postal_code', type: 'text' })
  postalCode!: string;

  @Column({ name: 'country_code', type: 'text' })
  countryCode!: string;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
