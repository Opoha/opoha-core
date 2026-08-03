/**
 * Public jobs module surface (Phase 8 A-01–A-04).
 */
export { JobsModule } from '../jobs.module';
export { JobsService } from '../jobs.service';
export { ScheduledJobRegistry } from '../scheduled-job.registry';
export { JobDefinitionEntity, JobRunEntity, jobEntities } from '../entities';
export { JOB_QUEUE_ADAPTER } from '../job-queue.adapter';
export type {
  JobExecuteHook,
  JobQueueAdapter,
  UpsertCronJobInput,
} from '../job-queue.adapter';
export { InMemoryJobQueueAdapter } from '../in-memory-job-queue.adapter';
export { BullMqJobQueueAdapter } from '../bullmq-job-queue.adapter';
export {
  assertCronExpression,
  cronMatchesAt,
  isValidCronExpression,
} from '../cron-expression';
export { JOB_RUN_STATUSES, isJobRunStatus } from '../job-status';
export type { JobRunStatus } from '../job-status';
export type {
  RegisterScheduledJobInput,
  RegisteredScheduledJob,
  ScheduledJobHandler,
  ScheduledJobHandlerContext,
} from '../scheduled-job';
export type { JobDefinitionType, JobRunType } from '../jobs.types';
/** @deprecated Prefer JobDefinitionType — alias kept for public re-exports. */
export type { JobDefinitionType as JobDefinitionRecord } from '../jobs.types';
/** @deprecated Prefer JobRunType — alias kept for public re-exports. */
export type { JobRunType as JobRunRecord } from '../jobs.types';
