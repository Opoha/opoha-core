/**
 * Job run lifecycle statuses.
 * See docs/readiness/jobs-cron-contracts.md
 */
export const JOB_RUN_STATUSES = ['pending', 'running', 'succeeded', 'failed', 'canceled'] as const;

export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number];

export function isJobRunStatus(value: string): value is JobRunStatus {
  return (JOB_RUN_STATUSES as readonly string[]).includes(value);
}
