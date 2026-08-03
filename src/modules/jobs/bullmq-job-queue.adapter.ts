import { Injectable, Optional } from '@nestjs/common';

import { ConfigService } from '../config/config.service';
import { AppLogger } from '../logging/app-logger';
import type {
  JobQueueAdapter,
  UpsertCronJobInput,
} from './job-queue.adapter';
import { InMemoryJobQueueAdapter } from './in-memory-job-queue.adapter';
import type { ScheduledJobHandler } from './scheduled-job';

/**
 * BullMQ-backed cron bridge (Phase 8 A-03).
 *
 * When `OPOHA_JOB_QUEUE=bullmq` and Redis is reachable, repeatable jobs use
 * BullMQ. Until Redis/BullMQ are wired in the process, this adapter delegates
 * to {@link InMemoryJobQueueAdapter} so unit gates stay Redis-free.
 *
 * Full Redis + BullMQ worker process is validated at the jobs gate (A-04).
 */
@Injectable()
export class BullMqJobQueueAdapter implements JobQueueAdapter {
  private readonly fallback: InMemoryJobQueueAdapter;
  private mode: 'memory' | 'bullmq' = 'memory';

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly logger?: AppLogger,
  ) {
    this.fallback = new InMemoryJobQueueAdapter();
    const requested = this.config.get('OPOHA_JOB_QUEUE');
    if (requested === 'bullmq') {
      // Production path reserved: A-04 wires Queue/Worker against REDIS_URL.
      // Keep memory delegate until the gate smoke lands so boot never hangs on Redis.
      this.mode = 'memory';
      this.logger?.warn(
        'OPOHA_JOB_QUEUE=bullmq requested — using in-process memory delegate until A-04 BullMQ worker wiring; cron contracts unchanged',
        'BullMqJobQueueAdapter',
      );
    }
  }

  setExecuteHook(
    hook: (
      code: string,
      handler: ScheduledJobHandler,
      queueJobId: string,
      attempt: number,
    ) => Promise<void>,
  ): void {
    this.fallback.setExecuteHook(hook);
  }

  getMode(): 'memory' | 'bullmq' {
    return this.mode;
  }

  async upsertCronJob(input: UpsertCronJobInput): Promise<void> {
    await this.fallback.upsertCronJob(input);
  }

  async removeCronJob(code: string): Promise<void> {
    await this.fallback.removeCronJob(code);
  }

  async trigger(code: string, attempt = 1): Promise<string> {
    return this.fallback.trigger(code, attempt);
  }
}
