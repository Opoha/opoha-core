import { NotFoundException } from '@nestjs/common';
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

describe('JobsService (A-02/A-03)', () => {
  const now = new Date('2026-08-04T04:00:00Z');
  let definitions: DefinitionRow[];
  let runs: RunRow[];
  let defSeq = 0;
  let runSeq = 0;
  let service: JobsService;
  let queue: InMemoryJobQueueAdapter;

  function buildService(): JobsService {
    definitions = [];
    runs = [];
    defSeq = 0;
    runSeq = 0;

    const definitionsRepo = {
      find: vi.fn(async () => [...definitions].sort((a, b) => a.code.localeCompare(b.code))),
      findOne: vi.fn(
        async ({ where }: { where: Partial<DefinitionRow> }) =>
          definitions.find((row) =>
            Object.entries(where).every(([k, v]) => row[k as keyof DefinitionRow] === v),
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
        const saved = { ...row, updatedAt: now };
        if (idx >= 0) {
          definitions[idx] = saved;
        } else {
          definitions.push(saved);
        }
        return saved;
      }),
    };

    const runsRepo = {
      find: vi.fn(async ({ where }: { where: Partial<RunRow> }) =>
        runs
          .filter((row) => Object.entries(where).every(([k, v]) => row[k as keyof RunRow] === v))
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
        createdAt: now,
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

    queue = new InMemoryJobQueueAdapter();
    const registry = new ScheduledJobRegistry();

    const svc = new JobsService(definitionsRepo as never, runsRepo as never, registry, queue);
    svc.onModuleInit();
    return svc;
  }

  beforeEach(() => {
    service = buildService();
  });

  it('registers a core job, persisting a job_definitions row', async () => {
    const handler = vi.fn(async () => undefined);
    const definition = await service.registerScheduledJob(null, {
      code: 'cleanup',
      displayName: 'Cleanup',
      cron: '0 0 * * *',
      handler,
    });

    expect(definition.code).toBe('cleanup');
    expect(definition.cronExpression).toBe('0 0 * * *');
    expect(definition.timezone).toBe('UTC');
    expect(definition.ownerPluginId).toBeNull();
    expect(definitions).toHaveLength(1);
  });

  it('prefixes plugin-registered job codes with the plugin id', async () => {
    const definition = await service.registerScheduledJob('plugin-subscriptions', {
      code: 'renew-due',
      cron: '0 * * * *',
      handler: vi.fn(async () => undefined),
    });

    expect(definition.code).toBe('plugin-subscriptions:renew-due');
    expect(definition.ownerPluginId).toBe('plugin-subscriptions');
  });

  it('rejects an invalid cron expression', async () => {
    await expect(
      service.registerScheduledJob(null, {
        code: 'bad',
        cron: 'not-a-cron',
        handler: vi.fn(async () => undefined),
      }),
    ).rejects.toThrow(/Invalid cron expression/);
  });

  it('trigger executes the handler and records a succeeded run — cron job is observable', async () => {
    const handler = vi.fn(async () => undefined);
    await service.registerScheduledJob(null, {
      code: 'cleanup',
      displayName: 'Cleanup',
      cron: '*/5 * * * *',
      handler,
    });

    const queueJobId = await service.trigger('cleanup');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(queueJobId).toMatch(/^memory:/);

    const history = await service.listRuns('cleanup');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      status: 'succeeded',
      attempt: 1,
      queueJobId,
    });
    expect(history[0]!.startedAt).toBeInstanceOf(Date);
    expect(history[0]!.finishedAt).toBeInstanceOf(Date);
  });

  it('trigger records a failed run with the error message when the handler throws', async () => {
    await service.registerScheduledJob(null, {
      code: 'flaky',
      cron: '0 * * * *',
      handler: vi.fn(async () => {
        throw new Error('boom');
      }),
    });

    await expect(service.trigger('flaky')).rejects.toThrow('boom');

    const history = await service.listRuns('flaky');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ status: 'failed', errorMessage: 'boom' });
  });

  it('listRuns throws NotFoundException for an unknown job code', async () => {
    await expect(service.listRuns('missing')).rejects.toThrow(NotFoundException);
  });

  it('re-registering the same code updates the existing definition instead of duplicating', async () => {
    await service.registerScheduledJob(null, {
      code: 'cleanup',
      displayName: 'Cleanup v1',
      cron: '0 0 * * *',
      handler: vi.fn(async () => undefined),
    });
    await service.registerScheduledJob(null, {
      code: 'cleanup',
      displayName: 'Cleanup v2',
      cron: '0 1 * * *',
      handler: vi.fn(async () => undefined),
    });

    expect(definitions).toHaveLength(1);
    const list = await service.listDefinitions();
    expect(list[0]!.name).toBe('Cleanup v2');
    expect(list[0]!.cronExpression).toBe('0 1 * * *');
  });
});
