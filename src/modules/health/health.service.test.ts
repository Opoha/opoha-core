import { describe, expect, it, vi } from 'vitest';

import type { DatabaseHealthService } from '../../infrastructure/database/database-health.service';
import type { RedisService } from '../../infrastructure/redis/redis.service';
import { HealthService } from './health.service';

function createHealth(
  dbPing: () => Promise<boolean>,
  redisPing: () => Promise<boolean>,
): HealthService {
  const database = { ping: dbPing } as unknown as DatabaseHealthService;
  const redis = { ping: redisPing } as unknown as RedisService;
  return new HealthService(database, redis);
}

describe('HealthService', () => {
  it('reports liveness ok', () => {
    expect(
      createHealth(
        async () => true,
        async () => true,
      ).liveness(),
    ).toEqual({ status: 'ok' });
  });

  it('returns ok when postgres and redis ping succeed', async () => {
    await expect(
      createHealth(
        async () => true,
        async () => true,
      ).readiness(),
    ).resolves.toEqual({
      status: 'ok',
      checks: { postgres: 'ok', redis: 'ok' },
    });
  });

  it('returns unavailable when postgres fails', async () => {
    await expect(
      createHealth(
        async () => {
          throw new Error('db down');
        },
        async () => true,
      ).readiness(),
    ).resolves.toEqual({
      status: 'unavailable',
      checks: { postgres: 'fail', redis: 'ok' },
    });
  });

  it('returns unavailable when redis fails', async () => {
    await expect(
      createHealth(
        async () => true,
        async () => false,
      ).readiness(),
    ).resolves.toEqual({
      status: 'unavailable',
      checks: { postgres: 'ok', redis: 'fail' },
    });
  });

  it('returns unavailable when both fail', async () => {
    await expect(
      createHealth(
        vi.fn().mockRejectedValue(new Error('db')),
        vi.fn().mockRejectedValue(new Error('redis')),
      ).readiness(),
    ).resolves.toEqual({
      status: 'unavailable',
      checks: { postgres: 'fail', redis: 'fail' },
    });
  });
});
