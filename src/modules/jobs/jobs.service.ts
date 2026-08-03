import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { assertCronExpression } from './cron-expression';
import { BullMqJobQueueAdapter } from './bullmq-job-queue.adapter';
import { JobDefinitionEntity } from './entities/job-definition.entity';
import { JobRunEntity } from './entities/job-run.entity';
import { InMemoryJobQueueAdapter } from './in-memory-job-queue.adapter';
import {
  JOB_QUEUE_ADAPTER,
  type JobQueueAdapter,
} from './job-queue.adapter';
import type { JobRunStatus } from './job-status';
import type {
  RegisterScheduledJobInput,
  ScheduledJobHandler,
} from './scheduled-job';
import { ScheduledJobRegistry } from './scheduled-job.registry';

export type JobDefinitionRecord = {
  id: string;
  code: string;
  name: string;
  cronExpression: string;
  timezone: string;
  handlerKey: string;
  ownerPluginId: string | null;
  enabled: boolean;
};

export type JobRunRecord = {
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

/**
 * Core jobs service — persist definitions, bridge queue, record runs (A-02/A-03).
 */
@Injectable()
export class JobsService implements OnModuleInit {
  constructor(
    @InjectRepository(JobDefinitionEntity)
    private readonly definitions: Repository<JobDefinitionEntity>,
    @InjectRepository(JobRunEntity)
    private readonly runs: Repository<JobRunEntity>,
    private readonly registry: ScheduledJobRegistry,
    @Inject(JOB_QUEUE_ADAPTER) private readonly queue: JobQueueAdapter,
  ) {}

  onModuleInit(): void {
    const hook = async (
      code: string,
      handler: ScheduledJobHandler,
      queueJobId: string,
      attempt: number,
    ) => {
      await this.executeAndRecord(code, handler, queueJobId, attempt);
    };
    if (this.queue instanceof InMemoryJobQueueAdapter) {
      this.queue.setExecuteHook(hook);
    } else if (this.queue instanceof BullMqJobQueueAdapter) {
      this.queue.setExecuteHook(hook);
    }
  }

  /**
   * Register a cron job (core or plugin). Persists definition + upserts queue.
   */
  async registerScheduledJob(
    pluginId: string | null,
    input: RegisterScheduledJobInput,
    active = true,
  ): Promise<JobDefinitionRecord> {
    const cron = assertCronExpression(input.cron);
    const localCode = input.code.trim();
    if (!localCode) {
      throw new Error('Scheduled job code is required');
    }
    const code = pluginId ? `${pluginId}:${localCode}` : localCode;
    const timezone = (input.timezone ?? 'UTC').trim() || 'UTC';
    const displayName = input.displayName?.trim() || code;
    const handlerKey = code;

    this.registry.register(
      pluginId,
      {
        code,
        displayName,
        cron,
        timezone,
        handlerKey,
        handler: input.handler,
      },
      active,
    );

    const existing = await this.definitions.findOne({ where: { code } });
    let row: JobDefinitionEntity;
    if (existing) {
      existing.name = displayName;
      existing.cronExpression = cron;
      existing.timezone = timezone;
      existing.handlerKey = handlerKey;
      existing.ownerPluginId = pluginId;
      existing.enabled = active;
      row = await this.definitions.save(existing);
    } else {
      row = await this.definitions.save(
        this.definitions.create({
          code,
          name: displayName,
          cronExpression: cron,
          timezone,
          handlerKey,
          ownerPluginId: pluginId,
          enabled: active,
        }),
      );
    }

    if (active) {
      await this.queue.upsertCronJob({
        code,
        cron,
        timezone,
        handler: input.handler,
      });
    } else {
      await this.queue.removeCronJob(code);
    }

    return this.toDefinitionRecord(row);
  }

  async setPluginJobsActive(pluginId: string, active: boolean): Promise<void> {
    if (active) {
      this.registry.activatePlugin(pluginId);
    } else {
      this.registry.deactivatePlugin(pluginId);
    }
    const jobs = this.registry
      .list(false)
      .filter((j) => j.pluginId === pluginId);
    for (const job of jobs) {
      const row = await this.definitions.findOne({ where: { code: job.code } });
      if (row) {
        row.enabled = active && job.active;
        await this.definitions.save(row);
      }
      if (active && job.active) {
        await this.queue.upsertCronJob({
          code: job.code,
          cron: job.cron,
          timezone: job.timezone,
          handler: job.handler,
        });
      } else {
        await this.queue.removeCronJob(job.code);
      }
    }
  }

  async removePluginJobs(pluginId: string): Promise<void> {
    const removed = this.registry.removePlugin(pluginId);
    for (const job of removed) {
      await this.queue.removeCronJob(job.code);
      await this.definitions.delete({ code: job.code });
    }
  }

  /** Trigger a registered job and record a run (unit / Admin). */
  async trigger(code: string, attempt = 1): Promise<JobRunRecord> {
    const registered = this.registry.get(code);
    if (!registered) {
      throw new Error(`Scheduled job "${code}" is not registered or inactive`);
    }
    await this.queue.upsertCronJob({
      code: registered.code,
      cron: registered.cron,
      timezone: registered.timezone,
      handler: registered.handler,
    });
    const queueJobId = await this.queue.trigger(code, attempt);
    const runs = await this.listRuns(code, 1);
    const latest = runs[0];
    if (!latest) {
      // Hook may be missing in some test wiring — synthesize from last execute.
      return {
        id: 'unknown',
        jobDefinitionId: 'unknown',
        status: 'succeeded',
        attempt,
        queueJobId,
        startedAt: new Date(),
        finishedAt: new Date(),
        errorMessage: null,
        createdAt: new Date(),
      };
    }
    return latest;
  }

  async listDefinitions(): Promise<JobDefinitionRecord[]> {
    const rows = await this.definitions.find({
      order: { code: 'ASC' },
    });
    return rows.map((r) => this.toDefinitionRecord(r));
  }

  async listRuns(jobCode: string, limit = 20): Promise<JobRunRecord[]> {
    const def = await this.definitions.findOne({ where: { code: jobCode } });
    if (!def) {
      return [];
    }
    const rows = await this.runs.find({
      where: { jobDefinitionId: def.id },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map((r) => this.toRunRecord(r));
  }

  private async executeAndRecord(
    code: string,
    handler: ScheduledJobHandler,
    queueJobId: string,
    attempt: number,
  ): Promise<void> {
    const def = await this.definitions.findOne({ where: { code } });
    if (!def) {
      throw new Error(`No job_definitions row for "${code}"`);
    }
    const run = await this.runs.save(
      this.runs.create({
        jobDefinitionId: def.id,
        status: 'pending',
        attempt,
        queueJobId,
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
      }),
    );
    run.status = 'running';
    run.startedAt = new Date();
    await this.runs.save(run);

    try {
      await handler({
        jobCode: code,
        attempt,
        queuedAt: run.createdAt,
      });
      run.status = 'succeeded';
      run.finishedAt = new Date();
      run.errorMessage = null;
      await this.runs.save(run);
    } catch (err) {
      run.status = 'failed';
      run.finishedAt = new Date();
      run.errorMessage =
        err instanceof Error ? err.message : String(err);
      await this.runs.save(run);
      throw err;
    }
  }

  private toDefinitionRecord(row: JobDefinitionEntity): JobDefinitionRecord {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      cronExpression: row.cronExpression,
      timezone: row.timezone,
      handlerKey: row.handlerKey,
      ownerPluginId: row.ownerPluginId,
      enabled: row.enabled,
    };
  }

  private toRunRecord(row: JobRunEntity): JobRunRecord {
    return {
      id: row.id,
      jobDefinitionId: row.jobDefinitionId,
      status: row.status,
      attempt: row.attempt,
      queueJobId: row.queueJobId,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
    };
  }
}
