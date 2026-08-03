import { Injectable } from '@nestjs/common';

export type LivenessResult = {
  status: 'ok';
};

export type ReadinessCheckStatus = 'stub' | 'ok' | 'fail';

export type ReadinessResult = {
  status: 'ok' | 'degraded';
  checks: {
    postgres: ReadinessCheckStatus;
    redis: ReadinessCheckStatus;
  };
};

@Injectable()
export class HealthService {
  liveness(): LivenessResult {
    return { status: 'ok' };
  }

  /**
   * Readiness stub until Phase B wires real Postgres/Redis probes (B-04).
   */
  readiness(): ReadinessResult {
    return {
      status: 'ok',
      checks: {
        postgres: 'stub',
        redis: 'stub',
      },
    };
  }
}
