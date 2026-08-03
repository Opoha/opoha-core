/**
 * Phase 8 A-04 — Jobs gate smoke.
 * Cron expression runs (memory adapter `runDueAt`) and is observable via
 * TypeORM `job_definitions` / `job_runs` (ADR-0010). BullMQ/Redis live
 * wiring remains optional per work plan (test double for CI).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InMemoryJobQueueAdapter } from './in-memory-job-queue.adapter';
import { JobsService } from './jobs.service';
import { ScheduledJobRegistry } from './scheduled-job.registry';

type DefinitionRow = {
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

type RunRow = {
  id: string;
  jobDefinitionId: string;
  status: string;
  attempt: number;
  queueJobId: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
};

describe('Jobs gate smoke (A-04)', () => {
  const now = new Date('2026-08-04T04:00:00Z');
  let definitions: DefinitionRow[];
  let runs: RunRow[];
  let service: JobsService;

  beforeEach(() => {
    definitions = [];
    runs = [];
    let defSeq = 0;
    let runSeq = 0;

    const definitionsRepo = {
      find: vi.fn(async () =>
        [...definitions].sort((a, b) => a.code.localeCompare(b.code)),
      ),
      findOne: vi.fn(async ({ where }: { where: Partial<DefinitionRow> }) =>
        definitions.find((row) =>
          Object.entries(where).every(
            ([k, v]) => row[k as keyof DefinitionRow] === v,
          ),
        ) ?? null,
      ),
      create: vi.fn((data: Partial<DefinitionRow>) => ({
        id: `def-${++defSeq}`,
        enabled: true,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: DefinitionRow) => {
        const idx = definitions.findIndex((r) => r.id === row.id);
        if (idx >= 0) {
          definitions[idx] = row;
        } else {
          definitions.push(row);
        }
        return row;
      }),
    };

    const runsRepo = {
      find: vi.fn(
        async ({
          where,
          order: _order,
        }: {
          where: Partial<RunRow>;
          order?: unknown;
        }) =>
          runs
            .filter((row) =>
              Object.entries(where).every(
                ([k, v]) => row[k as keyof RunRow] === v,
              ),
            )
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      ),
      create: vi.fn((data: Partial<RunRow>) => ({
        id: `run-${++runSeq}`,
        status: 'pending',
        attempt: 1,
        queueJobId: null,
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
        // Distinct timestamps so listRuns DESC order is stable in smoke.
        createdAt: new Date(now.getTime() + runSeq),
        ...data,
      })),
      save: vi.fn(async (row: RunRow) => {
        runs.push(row);
        return row;
      }),
      update: vi.fn(async (id: string, patch: Partial<RunRow>) => {
        const idx = runs.findIndex((r) => r.id === id);
        if (idx >= 0) {
          runs[idx] = { ...runs[idx]!, ...patch };
        }
      }),
    };

    service = new JobsService(
      definitionsRepo as never,
      runsRepo as never,
      new ScheduledJobRegistry(),
      new InMemoryJobQueueAdapter(),
    );
    service.onModuleInit();
  });

  it('cron expression fires via runDueAt and run is observable', async () => {
    let executions = 0;
    const def = await service.registerScheduledJob(null, {
      code: 'digest-email',
      displayName: 'Send daily digest',
      cron: '0 * * * *',
      timezone: 'UTC',
      handler: async () => {
        executions += 1;
      },
    });

    expect(def.cronExpression).toBe('0 * * * *');
    expect(def.enabled).toBe(true);

    const missed = await service.runDueAt(new Date('2026-08-04T04:01:00Z'));
    expect(missed).toHaveLength(0);
    expect(executions).toBe(0);

    const fired = await service.runDueAt(new Date('2026-08-04T04:00:00Z'));
    expect(fired).toHaveLength(1);
    expect(fired[0]?.code).toBe('digest-email');
    expect(fired[0]?.queueJobId).toMatch(/^memory:/);
    expect(executions).toBe(1);

    const run = fired[0]!.run;
    expect(run.status).toBe('succeeded');
    expect(run.jobDefinitionId).toBe(def.id);
    expect(run.queueJobId).toBe(fired[0]!.queueJobId);
    expect(run.startedAt).toBeInstanceOf(Date);
    expect(run.finishedAt).toBeInstanceOf(Date);
    expect(run.errorMessage).toBeNull();

    const history = await service.listRuns('digest-email');
    expect(history).toHaveLength(1);
    expect(history[0]?.status).toBe('succeeded');
  });

  it('plugin-prefixed cron job accumulates observable success and failure runs', async () => {
    await service.registerScheduledJob('sample', {
      code: 'tick',
      cron: '*/5 * * * *',
      handler: async () => undefined,
    });

    const fired = await service.runDueAt(new Date('2026-08-04T04:00:00Z'));
    expect(fired.map((f) => f.code)).toEqual(['sample:tick']);
    expect(fired[0]?.run.status).toBe('succeeded');

    await service.registerScheduledJob('sample', {
      code: 'tick',
      cron: '*/5 * * * *',
      handler: async () => {
        throw new Error('handler-failed');
      },
    });

    await expect(service.trigger('sample:tick')).rejects.toThrow(
      'handler-failed',
    );

    const history = await service.listRuns('sample:tick');
    expect(history).toHaveLength(2);
    expect(history[0]?.status).toBe('failed');
    expect(history[0]?.errorMessage).toBe('handler-failed');
    expect(history[1]?.status).toBe('succeeded');
  });
});
