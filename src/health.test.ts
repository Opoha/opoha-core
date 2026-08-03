import { describe, expect, it } from 'vitest';

import { loadEnv } from './modules/config/env.schema';
import { CORE_PACKAGE_NAME, getCorePackageName } from './package-meta';

describe('@opoha/core', () => {
  it('exposes package identity', () => {
    expect(getCorePackageName()).toBe(CORE_PACKAGE_NAME);
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
