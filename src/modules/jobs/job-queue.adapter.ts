import type { ScheduledJobHandler } from './scheduled-job';

/**
 * Queue bridge for cron-style jobs.
 * Production: BullMQ; unit gates: in-memory stub.
 */
export type UpsertCronJobInput = {
  code: string;
  cron: string;
  timezone: string;
  handler: ScheduledJobHandler;
};

/** Invoked by the adapter around handler execution so JobsService can record run history. */
export type JobExecuteHook = (
  code: string,
  handler: ScheduledJobHandler,
  queueJobId: string,
  attempt: number,
) => Promise<void>;

export type JobQueueAdapter = {
  upsertCronJob(input: UpsertCronJobInput): Promise<void>;
  removeCronJob(code: string): Promise<void>;
  /** Manually enqueue/run a registered job (tests + Admin trigger). */
  trigger(code: string, attempt?: number): Promise<string>;
  /** Optional — lets JobsService wrap execution to persist `job_runs` rows. */
  setExecuteHook?(hook: JobExecuteHook): void;
};

export const JOB_QUEUE_ADAPTER = Symbol('JOB_QUEUE_ADAPTER');
