import type { ScheduledJobHandler } from './scheduled-job';

/**
 * Queue bridge for cron-style jobs (Phase 8 A-03).
 * Production: BullMQ; unit gates: in-memory stub.
 */
export type UpsertCronJobInput = {
  code: string;
  cron: string;
  timezone: string;
  handler: ScheduledJobHandler;
};

export type JobQueueAdapter = {
  upsertCronJob(input: UpsertCronJobInput): Promise<void>;
  removeCronJob(code: string): Promise<void>;
  /** Manually enqueue/run a registered job (tests + Admin trigger). */
  trigger(code: string, attempt?: number): Promise<string>;
};

export const JOB_QUEUE_ADAPTER = Symbol('JOB_QUEUE_ADAPTER');
