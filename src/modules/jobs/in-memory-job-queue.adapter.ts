import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { cronMatchesAt } from './cron-expression';
import type {
  JobExecuteHook,
  JobQueueAdapter,
  UpsertCronJobInput,
} from './job-queue.adapter';

type StoredCron = UpsertCronJobInput;

/**
 * In-memory / test double for BullMQ cron bridge (Phase 8 A-03/A-04).
 * Stores cron registrations and executes handlers on {@link trigger}
 * or when {@link runDueAt} finds a matching expression (jobs gate smoke).
 */
@Injectable()
export class InMemoryJobQueueAdapter implements JobQueueAdapter {
  private readonly jobs = new Map<string, StoredCron>();
  private executeHook: JobExecuteHook | null = null;

  /**
   * JobsService wires this so runs are recorded when the queue fires.
   */
  setExecuteHook(hook: JobExecuteHook): void {
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
    return this.execute(code, job, attempt);
  }

  /**
   * Fire every registered job whose cron matches `at` (A-04 gate path).
   * Returns queue job ids keyed by job code.
   */
  async runDueAt(at: Date, attempt = 1): Promise<Map<string, string>> {
    const fired = new Map<string, string>();
    for (const [code, job] of [...this.jobs.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (cronMatchesAt(job.cron, at, job.timezone)) {
        const queueJobId = await this.execute(code, job, attempt);
        fired.set(code, queueJobId);
      }
    }
    return fired;
  }

  listCodes(): string[] {
    return [...this.jobs.keys()].sort();
  }

  private async execute(
    code: string,
    job: StoredCron,
    attempt: number,
  ): Promise<string> {
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
}
