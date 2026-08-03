import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** OWNER: auth/audit-logs — append-only; plugins must not alter this table. */
@Entity({ name: 'audit_logs' })
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Staff user who performed the action (null for anonymous failures if recorded). */
  @Index('audit_logs_actor_user_id_idx')
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Index('audit_logs_action_idx')
  @Column({ type: 'text' })
  action!: string;

  @Column({ name: 'resource_type', type: 'text', nullable: true })
  resourceType!: string | null;

  @Column({ name: 'resource_id', type: 'text', nullable: true })
  resourceId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
