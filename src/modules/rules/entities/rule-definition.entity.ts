import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { RuleActionRef, RuleConditions } from '../rule-conditions';

/**
 * Declarative automation rule.
 * OWNER: rules module — plugins must not alter this table.
 */
@Entity({ name: 'rule_definitions' })
export class RuleDefinitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable unique key for admin / references. */
  @Index('rule_definitions_code_uidx', { unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Domain event name that triggers evaluation (e.g. OrderPaid). */
  @Column({ name: 'event_name', type: 'text' })
  @Index('rule_definitions_event_name_idx')
  eventName!: string;

  /** Condition JSON evaluated against event `data`. */
  @Column({ type: 'jsonb', nullable: true })
  conditions!: RuleConditions | null;

  /** Ordered action refs (`action` registry key + params). */
  @Column({ name: 'action_refs', type: 'jsonb', default: [] })
  actionRefs!: RuleActionRef[];

  @Column({ type: 'boolean', default: true })
  @Index('rule_definitions_enabled_idx')
  enabled!: boolean;

  /** Lower runs first when multiple rules match the same event. */
  @Column({ type: 'integer', default: 100 })
  priority!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
