import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type {
  JobQueueAdapter,
  UpsertCronJobInput,
} from './job-queue.adapter';
import type { ScheduledJobHandler } from './scheduled-job';

type StoredCron = UpsertCronJobInput & {
  onExecute?: (queueJobId: string, attempt: number) => Promise<void>;
};

/**
 * In-memory / test double for BullMQ cron bridge (Phase 8 A-03).
 * Stores cron registrations and executes handlers on {@link trigger}.
 */
@Injectable()
export class InMemoryJobQueueAdapter implements JobQueueAdapter {
  private readonly jobs = new Map<string, StoredCron>();
  private executeHook:
    | ((
        code: string,
        handler: ScheduledJobHandler,
        queueJobId: string,
        attempt: number,
      ) => Promise<void>)
    | null = null;

  /**
   * JobsService wires this so runs are recorded when the queue fires.
   */
  setExecuteHook(
    hook: (
      code: string,
      handler: ScheduledJobHandler,
      queueJobId: string,
      attempt: number,
    ) => Promise<void>,
  ): void {
    this.executeHook = hook;
  }

  async upsertCronJob(input: UpsertCronJobInput): Promise<void> {
    this.jobs.set(input.code, { ...input });
  }

  async removeCronJob(code: string): Promise<void> {
    this.jobs.delete(code);
  }

  async trigger(code: string, attempt = 1): Promise<string> {
    const job = this.jobs.get(code);
    if (!job) {
      throw new Error(`Unknown scheduled job "${code}"`);
    }
    const queueJobId = `memory:${randomUUID()}`;
    if (this.executeHook) {
      await this.executeHook(code, job.handler, queueJobId, attempt);
    } else {
      await job.handler({
        jobCode: code,
        attempt,
        queuedAt: new Date(),
      });
    }
    return queueJobId;
  }

  listCodes(): string[] {
    return [...this.jobs.keys()].sort();
  }
}
