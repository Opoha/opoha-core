import { describe, expect, it } from 'vitest';

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
});
