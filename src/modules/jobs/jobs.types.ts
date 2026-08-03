import type { JobRunStatus } from './job-status';

/**
 * GraphQL/service-facing shapes for jobs observability (Phase 8 A-02/A-03).
 */
export type JobDefinitionType = {
  id: string;
  code: string;
  name: string;
  cronExpression: string;
  timezone: string;
  handlerKey: string;
  ownerPluginId: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type JobRunType = {
  id: string;
  jobDefinitionId: string;
  status: JobRunStatus;
  attempt: number;
  queueJobId: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
};
