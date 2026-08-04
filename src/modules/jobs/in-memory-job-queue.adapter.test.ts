import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InMemoryJobQueueAdapter } from './in-memory-job-queue.adapter';

describe('InMemoryJobQueueAdapter (A-03)', () => {
  let adapter: InMemoryJobQueueAdapter;

  beforeEach(() => {
    adapter = new InMemoryJobQueueAdapter();
  });

  it('throws when triggering an unregistered job code', async () => {
    await expect(adapter.trigger('unknown')).rejects.toThrow(/Unknown scheduled job/);
  });

  it('calls the registered handler directly when no execute hook is set', async () => {
    const handler = vi.fn(async () => undefined);
    await adapter.upsertCronJob({
      code: 'core:cleanup',
      cron: '0 0 * * *',
      timezone: 'UTC',
      handler,
    });

    const queueJobId = await adapter.trigger('core:cleanup', 1);

    expect(queueJobId).toMatch(/^memory:/);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ jobCode: 'core:cleanup', attempt: 1 }),
    );
  });

  it('routes execution through the execute hook when set (JobsService wiring)', async () => {
    const handler = vi.fn(async () => undefined);
    const hook = vi.fn(async (code, h, queueJobId, attempt) => {
      await h({ jobCode: code, attempt, queuedAt: new Date() });
    });
    adapter.setExecuteHook(hook);

    await adapter.upsertCronJob({
      code: 'core:cleanup',
      cron: '0 0 * * *',
      timezone: 'UTC',
      handler,
    });

    const queueJobId = await adapter.trigger('core:cleanup', 2);

    expect(hook).toHaveBeenCalledWith('core:cleanup', handler, queueJobId, 2);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('removeCronJob removes the job so a later trigger fails', async () => {
    await adapter.upsertCronJob({
      code: 'core:cleanup',
      cron: '0 0 * * *',
      timezone: 'UTC',
      handler: vi.fn(async () => undefined),
    });
    await adapter.removeCronJob('core:cleanup');

    await expect(adapter.trigger('core:cleanup')).rejects.toThrow(/Unknown scheduled job/);
  });

  it('listCodes returns registered codes sorted', async () => {
    await adapter.upsertCronJob({
      code: 'b:job',
      cron: '0 * * * *',
      timezone: 'UTC',
      handler: vi.fn(async () => undefined),
    });
    await adapter.upsertCronJob({
      code: 'a:job',
      cron: '0 * * * *',
      timezone: 'UTC',
      handler: vi.fn(async () => undefined),
    });

    expect(adapter.listCodes()).toEqual(['a:job', 'b:job']);
  });
});
