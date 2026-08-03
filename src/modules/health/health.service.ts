import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
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
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  liveness(): LivenessResult {
    return { status: 'ok' };
  }

  /**
   * Readiness probes Postgres (`SELECT 1`) and Redis (`PING`).
   * Returns `unavailable` when either check fails (controller maps to 503).
   */
  async readiness(): Promise<ReadinessResult> {
    const [postgres, redis] = await Promise.all([
      this.probe(() => this.prisma.ping()),
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
