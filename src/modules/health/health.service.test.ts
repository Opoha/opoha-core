import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { RedisService } from '../../infrastructure/redis/redis.service';
import { HealthService } from './health.service';

function createHealth(
  prismaPing: () => Promise<boolean>,
  redisPing: () => Promise<boolean>,
): HealthService {
  const prisma = { ping: prismaPing } as unknown as PrismaService;
  const redis = { ping: redisPing } as unknown as RedisService;
  return new HealthService(prisma, redis);
}

describe('HealthService', () => {
  it('reports liveness ok', () => {
    const health = createHealth(
      async () => true,
      async () => true,
    );
    expect(health.liveness()).toEqual({ status: 'ok' });
  });

  it('returns ok when postgres and redis ping succeed', async () => {
    const health = createHealth(
      async () => true,
      async () => true,
    );
    await expect(health.readiness()).resolves.toEqual({
      status: 'ok',
      checks: { postgres: 'ok', redis: 'ok' },
    });
  });

  it('returns unavailable when postgres fails', async () => {
    const health = createHealth(
      async () => {
        throw new Error('db down');
      },
      async () => true,
    );
    await expect(health.readiness()).resolves.toEqual({
      status: 'unavailable',
      checks: { postgres: 'fail', redis: 'ok' },
    });
  });

  it('returns unavailable when redis fails', async () => {
    const health = createHealth(
      async () => true,
      async () => false,
    );
    await expect(health.readiness()).resolves.toEqual({
      status: 'unavailable',
      checks: { postgres: 'ok', redis: 'fail' },
    });
  });

  it('returns unavailable when both fail', async () => {
    const health = createHealth(
      vi.fn().mockRejectedValue(new Error('db')),
      vi.fn().mockRejectedValue(new Error('redis')),
    );
    await expect(health.readiness()).resolves.toEqual({
      status: 'unavailable',
      checks: { postgres: 'fail', redis: 'fail' },
    });
  });
});
