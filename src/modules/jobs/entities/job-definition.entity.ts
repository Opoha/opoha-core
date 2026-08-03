import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Scheduled job definition (Phase 8 A-02).
 * OWNER: jobs module — plugins must not alter this table.
 */
@Entity({ name: 'job_definitions' })
export class JobDefinitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable unique key (`pluginId:localCode` or core code). */
  @Index('job_definitions_code_uidx', { unique: true })
  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'cron_expression', type: 'text' })
  cronExpression!: string;

  @Column({ type: 'text', default: 'UTC' })
  timezone!: string;

  /** Registry key resolved to an in-process handler. */
  @Column({ name: 'handler_key', type: 'text' })
  handlerKey!: string;

  /** Null for core-owned jobs. */
  @Column({ name: 'owner_plugin_id', type: 'text', nullable: true })
  ownerPluginId!: string | null;

  @Column({ type: 'boolean', default: true })
  @Index('job_definitions_enabled_idx')
  enabled!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
