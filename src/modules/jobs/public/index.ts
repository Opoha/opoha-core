/**
 * Public jobs module surface (Phase 8 A-01–A-03).
 */
export { JobsModule } from '../jobs.module';
export { JobsService } from '../jobs.service';
export type {
  JobDefinitionRecord,
  JobRunRecord,
} from '../jobs.service';
export { ScheduledJobRegistry } from '../scheduled-job.registry';
export {
  JOB_QUEUE_ADAPTER,
  type JobQueueAdapter,
  type UpsertCronJobInput,
} from '../job-queue.adapter';
export { InMemoryJobQueueAdapter } from '../in-memory-job-queue.adapter';
export { BullMqJobQueueAdapter } from '../bullmq-job-queue.adapter';
export {
  JobDefinitionEntity,
  JobRunEntity,
  jobEntities,
} from '../entities';
export {
  JOB_RUN_STATUSES,
  isJobRunStatus,
} from '../job-status';
export type { JobRunStatus } from '../job-status';
export {
  assertCronExpression,
  isValidCronExpression,
} from '../cron-expression';
export type {
  ScheduledJobHandler,
  ScheduledJobHandlerContext,
  RegisterScheduledJobInput,
  RegisteredScheduledJob,
} from '../scheduled-job';
