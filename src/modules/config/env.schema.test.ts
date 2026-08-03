import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.schema';

describe('loadEnv', () => {
  it('applies safe defaults for optional keys', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://opoha:opoha@localhost:5433/opoha',
      REDIS_URL: 'redis://localhost:6380',
    });
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.OTEL_ENABLED).toBe(false);
  });

  it('coerces PORT and accepts LOG_LEVEL', () => {
    const env = loadEnv({
      PORT: '4123',
      LOG_LEVEL: 'debug',
      DATABASE_URL: 'postgresql://opoha:opoha@localhost:5433/opoha',
      REDIS_URL: 'redis://localhost:6380',
      OTEL_ENABLED: 'true',
    });
    expect(env.PORT).toBe(4123);
    expect(env.LOG_LEVEL).toBe('debug');
    expect(env.OTEL_ENABLED).toBe(true);
  });

  it('fails fast on invalid LOG_LEVEL', () => {
    expect(() =>
      loadEnv({
        LOG_LEVEL: 'trace',
        DATABASE_URL: 'postgresql://opoha:opoha@localhost:5433/opoha',
        REDIS_URL: 'redis://localhost:6380',
      }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('fails fast on empty DATABASE_URL', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: '',
        REDIS_URL: 'redis://localhost:6380',
      }),
    ).toThrow(/Invalid environment configuration/);
  });
});
