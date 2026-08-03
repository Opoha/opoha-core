import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CustomerGroupMembershipEntity } from './customer-group-membership.entity';

/** OWNER: customer module — plugins must not alter this table. */
@Entity({ name: 'customer_groups' })
export class CustomerGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(
    () => CustomerGroupMembershipEntity,
    (membership) => membership.group,
  )
  memberships!: CustomerGroupMembershipEntity[];
}
