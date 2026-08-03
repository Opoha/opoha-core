import { describe, expect, it } from 'vitest';

import { loadEnv } from './modules/config/env.schema';
import { HealthService } from './modules/health/health.service';
import { CORE_PACKAGE_NAME, getCorePackageName } from './package-meta';

describe('@opoha/core', () => {
  it('exposes package identity', () => {
    expect(getCorePackageName()).toBe(CORE_PACKAGE_NAME);
  });

  it('reports liveness ok', () => {
    const health = new HealthService();
    expect(health.liveness()).toEqual({ status: 'ok' });
  });

  it('returns readiness stub checks', () => {
    const health = new HealthService();
    expect(health.readiness()).toEqual({
      status: 'ok',
      checks: { postgres: 'stub', redis: 'stub' },
    });
  });

  it('loads typed env with defaults', () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      PORT: '4010',
      DATABASE_URL: 'postgresql://opoha:opoha@localhost:5433/opoha',
      REDIS_URL: 'redis://localhost:6380',
    });
    expect(env.PORT).toBe(4010);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.OTEL_ENABLED).toBe(false);
  });

  it('rejects invalid PORT', () => {
    expect(() =>
      loadEnv({
        PORT: '-1',
        DATABASE_URL: 'postgresql://opoha:opoha@localhost:5433/opoha',
        REDIS_URL: 'redis://localhost:6380',
      }),
    ).toThrow(/Invalid environment configuration/);
  });
});
