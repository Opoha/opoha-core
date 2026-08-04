import { describe, expect, it, vi } from 'vitest';

import { JobsResolver } from './jobs.resolver';
import type { JobsService } from './jobs.service';

describe('JobsResolver', () => {
  it('lists definitions and runs; triggers by code', async () => {
    const now = new Date('2026-08-04T00:00:00.000Z');
    const jobs = {
      listDefinitions: vi.fn().mockResolvedValue([
        {
          id: 'j1',
          code: 'core.cleanup',
          name: 'Cleanup',
          cronExpression: '0 * * * *',
          timezone: 'UTC',
          handlerKey: 'core.cleanup',
          ownerPluginId: null,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        },
      ]),
      findDefinitionByCode: vi.fn().mockResolvedValue({
        id: 'j1',
        code: 'core.cleanup',
        name: 'Cleanup',
        cronExpression: '0 * * * *',
        timezone: 'UTC',
        handlerKey: 'core.cleanup',
        ownerPluginId: null,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      }),
      listRuns: vi.fn().mockResolvedValue([
        {
          id: 'r1',
          jobDefinitionId: 'j1',
          status: 'succeeded',
          attempt: 1,
          queueJobId: 'q1',
          startedAt: now,
          finishedAt: now,
          errorMessage: null,
          createdAt: now,
        },
      ]),
      trigger: vi.fn().mockResolvedValue('q-triggered'),
    } as unknown as JobsService;

    const resolver = new JobsResolver(jobs);
    const defs = await resolver.jobDefinitions();
    expect(defs[0]?.code).toBe('core.cleanup');

    const one = await resolver.jobDefinition('core.cleanup');
    expect(one.name).toBe('Cleanup');

    const runs = await resolver.jobRuns('core.cleanup');
    expect(runs[0]?.status).toBe('succeeded');

    const queueId = await resolver.triggerJob('core.cleanup');
    expect(queueId).toBe('q-triggered');
    expect(jobs.trigger).toHaveBeenCalledWith('core.cleanup');
  });
});
