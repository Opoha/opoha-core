/**
 * Job run lifecycle statuses (Phase 8 A-01/A-02).
 * See docs/readiness/jobs-cron-contracts.md
 */
export const JOB_RUN_STATUSES = ['pending', 'running', 'succeeded', 'failed', 'canceled'] as const;

export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number];

export function isJobRunStatus(value: string): value is JobRunStatus {
  return (JOB_RUN_STATUSES as readonly string[]).includes(value);
}
