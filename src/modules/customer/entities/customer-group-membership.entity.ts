import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { CustomerEntity } from './customer.entity';
import { CustomerGroupEntity } from './customer-group.entity';

/** OWNER: customer module — plugins must not alter this table. */
@Entity({ name: 'customer_group_memberships' })
@Unique('customer_group_memberships_customer_group_key', ['customerId', 'groupId'])
export class CustomerGroupMembershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @ManyToOne(() => CustomerEntity, (customer) => customer.groupMemberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer!: CustomerEntity;

  @ManyToOne(() => CustomerGroupEntity, (group) => group.memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_id' })
  group!: CustomerGroupEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
