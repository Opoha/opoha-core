import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { ConfigService } from '../../modules/config/config.service';

/**
 * Lightweight Redis client for readiness probes and future cache/queue use.
 * Connection is lazy on first ping so the process can boot before `docker:up`.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis | null = null;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private getClient(): Redis {
    if (!this.client) {
      this.client = new Redis(this.config.get('REDIS_URL'), {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
    }
    return this.client;
  }

  async ping(): Promise<boolean> {
    const client = this.getClient();
    if (client.status === 'wait') {
      await client.connect();
    }
    const result = await client.ping();
    return result === 'PONG';
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    } finally {
      this.client = null;
    }
  }
}
