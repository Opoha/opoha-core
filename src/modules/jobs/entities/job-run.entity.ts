import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { JobRunStatus } from '../job-status';

/**
 * Job execution observability row (Phase 8 A-02).
 * OWNER: jobs module — plugins must not alter this table.
 */
@Entity({ name: 'job_runs' })
@Index('job_runs_job_definition_id_idx', ['jobDefinitionId'])
@Index('job_runs_status_idx', ['status'])
export class JobRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'job_definition_id', type: 'uuid' })
  jobDefinitionId!: string;

  @Column({ type: 'text', default: 'pending' })
  status!: JobRunStatus;

  @Column({ type: 'integer', default: 1 })
  attempt!: number;

  @Column({ name: 'queue_job_id', type: 'text', nullable: true })
  queueJobId!: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
