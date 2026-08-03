import { Inject, Injectable } from '@nestjs/common';

import { DatabaseHealthService } from '../../infrastructure/database/database-health.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

export type LivenessResult = {
  status: 'ok';
};

export type ReadinessCheckStatus = 'ok' | 'fail';

export type ReadinessResult = {
  status: 'ok' | 'unavailable';
  checks: {
    postgres: ReadinessCheckStatus;
    redis: ReadinessCheckStatus;
  };
};

@Injectable()
export class HealthService {
  constructor(
    @Inject(DatabaseHealthService) private readonly database: DatabaseHealthService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  liveness(): LivenessResult {
    return { status: 'ok' };
  }

  async readiness(): Promise<ReadinessResult> {
    const [postgres, redis] = await Promise.all([
      this.probe(() => this.database.ping()),
      this.probe(() => this.redis.ping()),
    ]);

    const ok = postgres === 'ok' && redis === 'ok';
    return {
      status: ok ? 'ok' : 'unavailable',
      checks: { postgres, redis },
    };
  }

  private async probe(fn: () => Promise<boolean>): Promise<ReadinessCheckStatus> {
    try {
      const success = await fn();
      return success ? 'ok' : 'fail';
    } catch {
      return 'fail';
    }
  }
}
