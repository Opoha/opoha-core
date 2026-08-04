import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { assertCronExpression } from './cron-expression';
import { JobDefinitionEntity } from './entities/job-definition.entity';
import { JobRunEntity } from './entities/job-run.entity';
import { InMemoryJobQueueAdapter } from './in-memory-job-queue.adapter';
import { JOB_QUEUE_ADAPTER, type JobQueueAdapter } from './job-queue.adapter';
import type { RegisterScheduledJobInput, ScheduledJobHandler } from './scheduled-job';
import { ScheduledJobRegistry } from './scheduled-job.registry';
import type { JobDefinitionType, JobRunType } from './jobs.types';

function toJobDefinitionType(row: JobDefinitionEntity): JobDefinitionType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    cronExpression: row.cronExpression,
    timezone: row.timezone,
    handlerKey: row.handlerKey,
    ownerPluginId: row.ownerPluginId,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toJobRunType(row: JobRunEntity): JobRunType {
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

/**
 * Core `jobs` module service.
 *
 * Ties {@link ScheduledJobRegistry} (in-process handlers), the pluggable
 * {@link JobQueueAdapter} (BullMQ in production; in-memory stub for unit
 * gates — see docs/readiness/jobs-cron-contracts.md), and the TypeORM
 * `job_definitions` / `job_runs` tables together so every execution is
 * persisted and observable regardless of which adapter is wired.
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
    this.queue.setExecuteHook?.(this.recordExecution.bind(this));
  }

  /**
   * Registers a cron-style job: persists/updates the `job_definitions` row,
   * activates the in-process handler in the registry, and upserts the cron
   * in the queue adapter. `pluginId` is null for core-owned jobs.
   * `active` mirrors plugin enable state at registration time.
   */
  async registerScheduledJob(
    pluginId: string | null,
    input: RegisterScheduledJobInput,
    active = true,
  ): Promise<JobDefinitionType> {
    const localCode = input.code.trim();
    if (!localCode) {
      throw new BadRequestException('Scheduled job code is required');
    }
    const code = pluginId ? `${pluginId}:${localCode}` : localCode;
    const cron = assertCronExpression(input.cron);
    const timezone = input.timezone?.trim() || 'UTC';
    const displayName = input.displayName?.trim() || localCode;

    const definition = await this.upsertDefinition({
      code,
      name: displayName,
      cronExpression: cron,
      timezone,
      handlerKey: code,
      ownerPluginId: pluginId,
      enabled: active,
    });

    this.registry.register(
      pluginId,
      {
        code,
        displayName,
        cron,
        timezone,
        handlerKey: code,
        handler: input.handler,
      },
      active,
    );

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

    return toJobDefinitionType(definition);
  }

  /** Enable/disable all scheduled jobs owned by a plugin (lifecycle). */
  async setPluginJobsActive(pluginId: string, active: boolean): Promise<void> {
    if (active) {
      this.registry.activatePlugin(pluginId);
    } else {
      this.registry.deactivatePlugin(pluginId);
    }
    const jobs = this.registry.list(false).filter((j) => j.pluginId === pluginId);
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

  /** Remove plugin job definitions from registry, queue, and TypeORM. */
  async removePluginJobs(pluginId: string): Promise<void> {
    const removed = this.registry.removePlugin(pluginId);
    for (const job of removed) {
      await this.queue.removeCronJob(job.code);
      await this.definitions.delete({ code: job.code });
    }
  }

  /** Manually fire a registered job (Admin trigger / test gate). */
  async trigger(code: string, attempt = 1): Promise<string> {
    return this.queue.trigger(code, attempt);
  }

  /**
 * Fire every registered cron job due at `at` (memory adapter / jobs gate).
   * Production BullMQ workers schedule via Redis repeatables instead.
   */
  async runDueAt(
    at: Date,
    attempt = 1,
  ): Promise<Array<{ code: string; queueJobId: string; run: JobRunType }>> {
    if (!(this.queue instanceof InMemoryJobQueueAdapter)) {
      throw new BadRequestException(
        'runDueAt requires the in-memory job queue adapter (jobs gate / unit tests)',
      );
    }
    const fired = await this.queue.runDueAt(at, attempt);
    const out: Array<{ code: string; queueJobId: string; run: JobRunType }> = [];
    for (const [code, queueJobId] of fired) {
      const runs = await this.listRuns(code);
      const run = runs[0];
      if (!run) {
        throw new Error(`Job "${code}" fired but no job_runs observability row was recorded`);
      }
      out.push({ code, queueJobId, run });
    }
    return out;
  }

  async listDefinitions(): Promise<JobDefinitionType[]> {
    const rows = await this.definitions.find({ order: { code: 'ASC' } });
    return rows.map(toJobDefinitionType);
  }

  async findDefinitionByCode(code: string): Promise<JobDefinitionType> {
    const row = await this.definitions.findOne({ where: { code } });
    if (!row) {
      throw new NotFoundException(`Scheduled job "${code}" not found`);
    }
    return toJobDefinitionType(row);
  }

  async listRuns(code: string): Promise<JobRunType[]> {
    const definition = await this.definitions.findOne({ where: { code } });
    if (!definition) {
      throw new NotFoundException(`Scheduled job "${code}" not found`);
    }
    const rows = await this.runs.find({
      where: { jobDefinitionId: definition.id },
      order: { createdAt: 'DESC' },
    });
    return rows.map(toJobRunType);
  }

  /**
   * Queue-agnostic execution wrapper: creates a `job_runs` row, invokes the
   * handler, then records success/failure. Wired via
   * {@link JobQueueAdapter.setExecuteHook} in {@link onModuleInit} so both
   * the in-memory stub and a future BullMQ worker share the same recording
   * logic.
   */
  private async recordExecution(
    code: string,
    handler: ScheduledJobHandler,
    queueJobId: string,
    attempt: number,
  ): Promise<void> {
    const definition = await this.definitions.findOne({ where: { code } });
    if (!definition) {
      throw new Error(`Unknown scheduled job "${code}" — no job_definitions row`);
    }

    const startedAt = new Date();
    const run = await this.runs.save(
      this.runs.create({
        jobDefinitionId: definition.id,
        status: 'running',
        attempt,
        queueJobId,
        startedAt,
      }),
    );

    try {
      await handler({ jobCode: code, attempt, queuedAt: startedAt });
      await this.runs.update(run.id, {
        status: 'succeeded',
        finishedAt: new Date(),
      });
    } catch (error) {
      await this.runs.update(run.id, {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async upsertDefinition(data: {
    code: string;
    name: string;
    cronExpression: string;
    timezone: string;
    handlerKey: string;
    ownerPluginId: string | null;
    enabled: boolean;
  }): Promise<JobDefinitionEntity> {
    const existing = await this.definitions.findOne({
      where: { code: data.code },
    });
    if (existing) {
      Object.assign(existing, data);
      return this.definitions.save(existing);
    }
    return this.definitions.save(this.definitions.create(data));
  }
}
