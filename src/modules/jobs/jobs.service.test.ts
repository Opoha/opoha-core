import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InMemoryJobQueueAdapter } from './in-memory-job-queue.adapter';
import { JobsService } from './jobs.service';
import { ScheduledJobRegistry } from './scheduled-job.registry';

type DefRow = {
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
  let defs: DefRow[];
  let runs: RunRow[];
  let definitionsRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let runsRepo: {
    find: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let registry: ScheduledJobRegistry;
  let queue: InMemoryJobQueueAdapter;
  let service: JobsService;

  beforeEach(() => {
    defs = [];
    runs = [];
    let defSeq = 0;
    let runSeq = 0;

    definitionsRepo = {
      find: vi.fn(async () =>
        [...defs].sort((a, b) => a.code.localeCompare(b.code)),
      ),
      findOne: vi.fn(async ({ where }: { where: Partial<DefRow> }) => {
        if (where.code) {
          return defs.find((d) => d.code === where.code) ?? null;
        }
        if (where.id) {
          return defs.find((d) => d.id === where.id) ?? null;
        }
        return null;
      }),
      create: vi.fn((input: Partial<DefRow>) => ({ ...input })),
      save: vi.fn(async (row: Partial<DefRow>) => {
        if (row.id) {
          const idx = defs.findIndex((d) => d.id === row.id);
          if (idx >= 0) {
            defs[idx] = { ...defs[idx]!, ...row, updatedAt: now } as DefRow;
            return defs[idx];
          }
        }
        defSeq += 1;
        const created: DefRow = {
          id: `def-${defSeq}`,
          code: row.code!,
          name: row.name!,
          cronExpression: row.cronExpression!,
          timezone: row.timezone ?? 'UTC',
          handlerKey: row.handlerKey!,
          ownerPluginId: row.ownerPluginId ?? null,
          enabled: row.enabled ?? true,
          createdAt: now,
          updatedAt: now,
        };
        defs.push(created);
        return created;
      }),
      delete: vi.fn(async ({ code }: { code: string }) => {
        defs = defs.filter((d) => d.code !== code);
      }),
    };

    runsRepo = {
      find: vi.fn(
        async ({
          where,
          take,
        }: {
          where: { jobDefinitionId: string };
          take?: number;
        }) => {
          const matched = runs
            .filter((r) => r.jobDefinitionId === where.jobDefinitionId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          return take ? matched.slice(0, take) : matched;
        },
      ),
      create: vi.fn((input: Partial<RunRow>) => ({
        ...input,
        createdAt: now,
      })),
      save: vi.fn(async (row: Partial<RunRow> & { createdAt?: Date }) => {
        if (row.id) {
          const idx = runs.findIndex((r) => r.id === row.id);
          if (idx >= 0) {
            runs[idx] = { ...runs[idx]!, ...row } as RunRow;
            return runs[idx];
          }
        }
        runSeq += 1;
        const created: RunRow = {
          id: `run-${runSeq}`,
          jobDefinitionId: row.jobDefinitionId!,
          status: (row.status as string) ?? 'pending',
          attempt: row.attempt ?? 1,
          queueJobId: row.queueJobId ?? null,
          startedAt: row.startedAt ?? null,
          finishedAt: row.finishedAt ?? null,
          errorMessage: row.errorMessage ?? null,
          createdAt: row.createdAt ?? now,
        };
        runs.push(created);
        return created;
      }),
    };

    registry = new ScheduledJobRegistry();
    queue = new InMemoryJobQueueAdapter();
    service = new JobsService(
      definitionsRepo as never,
      runsRepo as never,
      registry,
      queue,
    );
    service.onModuleInit();
  });

  it('registers a core cron job, persists definition, and records a successful run', async () => {
    const handler = vi.fn(async () => undefined);
    const def = await service.registerScheduledJob(null, {
      code: 'heartbeat',
      displayName: 'Heartbeat',
      cron: '*/5 * * * *',
      handler,
    });

    expect(def.code).toBe('heartbeat');
    expect(def.cronExpression).toBe('*/5 * * * *');
    expect(defs).toHaveLength(1);
    expect(queue.listCodes()).toEqual(['heartbeat']);

    const run = await service.trigger('heartbeat');
    expect(handler).toHaveBeenCalledOnce();
    expect(run.status).toBe('succeeded');
    expect(run.queueJobId).toMatch(/^memory:/);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe('succeeded');
  });

  it('prefixes plugin job codes and records failures', async () => {
    const handler = vi.fn(async () => {
      throw new Error('boom');
    });
    await service.registerScheduledJob('subscription', {
      code: 'renew-due',
      cron: '0 * * * *',
      handler,
    });

    expect(defs[0]?.code).toBe('subscription:renew-due');
    expect(defs[0]?.ownerPluginId).toBe('subscription');

    await expect(service.trigger('subscription:renew-due')).rejects.toThrow(
      'boom',
    );
    expect(runs[0]?.status).toBe('failed');
    expect(runs[0]?.errorMessage).toBe('boom');
  });

  it('rejects invalid cron at registration', async () => {
    await expect(
      service.registerScheduledJob(null, {
        code: 'bad',
        cron: '* * *',
        handler: async () => undefined,
      }),
    ).rejects.toThrow(/Invalid cron/);
  });
});
