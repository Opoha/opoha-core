import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { SegmentRules } from '../segment-rules';

/**
 * Rule-based customer segment for promotions (Phase 4 E-01).
 * OWNER: segments module — plugins must not alter this table.
 * Distinct from manual {@link CustomerGroupEntity} membership lists.
 */
@Entity({ name: 'customer_segments' })
export class CustomerSegmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable segment code for admin / promotion references. */
  @Index('customer_segments_code_uidx', { unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /**
   * Membership rules (tags / order count / spend).
   * Evaluated by {@link evaluateSegmentRules}; empty/null = match everyone when active.
   */
  @Column({ type: 'jsonb', nullable: true })
  rules!: SegmentRules | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
