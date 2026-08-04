import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppLogger } from '../logging/app-logger';
import { WebhookDeliveryAttemptEntity } from './entities/webhook-delivery-attempt.entity';
import { WebhookEndpointEntity } from './entities/webhook-endpoint.entity';
import {
  createFetchWebhookHttpClient,
  WEBHOOK_HTTP_CLIENT,
  type WebhookHttpClient,
} from './webhook-http.client';
import {
  signWebhookPayload,
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
} from './webhook-signing';
import {
  DEFAULT_WEBHOOK_BACKOFF_MS,
  DEFAULT_WEBHOOK_MAX_ATTEMPTS,
  webhookBackoffMs,
} from './webhook-status';

export type DeliverResult = {
  attemptId: string;
  status: 'succeeded' | 'failed' | 'dead_letter';
  attempt: number;
  responseStatus: number | null;
};

/**
 * Delivers pending/failed webhook attempts with HMAC signing + retry backoff
 *. HTTP is injectable for Vitest mocks.
 */
@Injectable()
export class WebhookDeliveryWorker {
  private http: WebhookHttpClient;
  private maxAttempts = DEFAULT_WEBHOOK_MAX_ATTEMPTS;
  private backoffMs: readonly number[] = DEFAULT_WEBHOOK_BACKOFF_MS;

  constructor(
    @InjectRepository(WebhookDeliveryAttemptEntity)
    private readonly attempts: Repository<WebhookDeliveryAttemptEntity>,
    @InjectRepository(WebhookEndpointEntity)
    private readonly endpoints: Repository<WebhookEndpointEntity>,
    @Optional()
    @Inject(WEBHOOK_HTTP_CLIENT)
    httpClient?: WebhookHttpClient,
    @Optional() private readonly logger?: AppLogger,
  ) {
    this.http = httpClient ?? createFetchWebhookHttpClient();
  }

  /** Test / gate helper — override max attempts and backoff schedule. */
  configure(opts: {
    maxAttempts?: number;
    backoffMs?: readonly number[];
    http?: WebhookHttpClient;
  }): this {
    if (opts.maxAttempts !== undefined) {
      this.maxAttempts = opts.maxAttempts;
    }
    if (opts.backoffMs !== undefined) {
      this.backoffMs = opts.backoffMs;
    }
    if (opts.http !== undefined) {
      this.http = opts.http;
    }
    return this;
  }

  /**
   * Process due deliveries (status pending|failed and next_attempt_at <= now).
   */
  async processDue(now: Date = new Date(), limit = 50): Promise<DeliverResult[]> {
    const due = await this.attempts
.createQueryBuilder('a')
.where('a.status IN (:...statuses)', {
        statuses: ['pending', 'failed'],
      })
.andWhere('(a.nextAttemptAt IS NULL OR a.nextAttemptAt <= :now)', {
        now,
      })
.orderBy('a.createdAt', 'ASC')
.take(limit)
.getMany();

    const results: DeliverResult[] = [];
    for (const row of due) {
      results.push(await this.deliverAttempt(row, now));
    }
    return results;
  }

  /** Deliver a single attempt row (or retry it). */
  async deliverAttempt(
    row: WebhookDeliveryAttemptEntity,
    now: Date = new Date(),
  ): Promise<DeliverResult> {
    const endpoint = await this.endpoints.findOne({
      where: { id: row.endpointId },
    });
    if (!endpoint) {
      row.status = 'dead_letter';
      row.errorMessage = 'endpoint missing';
      row.finishedAt = now;
      row.nextAttemptAt = null;
      await this.attempts.save(row);
      return {
        attemptId: row.id,
        status: 'dead_letter',
        attempt: row.attempt,
        responseStatus: null,
      };
    }

    const body = JSON.stringify(row.payload);
    const signature = signWebhookPayload(endpoint.secret, body);
    row.signature = signature;

    try {
      const response = await this.http.post({
        url: endpoint.url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [WEBHOOK_SIGNATURE_HEADER]: signature,
          [WEBHOOK_EVENT_HEADER]: row.eventName,
          [WEBHOOK_DELIVERY_HEADER]: row.id,
        },
        body,
      });

      row.responseStatus = response.status;
      row.responseBody = response.body;

      if (response.status >= 200 && response.status < 300) {
        row.status = 'succeeded';
        row.errorMessage = null;
        row.finishedAt = now;
        row.nextAttemptAt = null;
        await this.attempts.save(row);
        return {
          attemptId: row.id,
          status: 'succeeded',
          attempt: row.attempt,
          responseStatus: response.status,
        };
      }

      return this.scheduleRetryOrDeadLetter(row, now, `HTTP ${response.status}`, response.status);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'delivery failed';
      this.logger?.warn(`Webhook delivery ${row.id} failed: ${message}`, 'WebhookDeliveryWorker');
      return this.scheduleRetryOrDeadLetter(row, now, message, null);
    }
  }

  private async scheduleRetryOrDeadLetter(
    row: WebhookDeliveryAttemptEntity,
    now: Date,
    errorMessage: string,
    responseStatus: number | null,
  ): Promise<DeliverResult> {
    row.errorMessage = errorMessage;
    row.responseStatus = responseStatus;

    if (row.attempt >= this.maxAttempts) {
      row.status = 'dead_letter';
      row.finishedAt = now;
      row.nextAttemptAt = null;
      await this.attempts.save(row);
      return {
        attemptId: row.id,
        status: 'dead_letter',
        attempt: row.attempt,
        responseStatus,
      };
    }

    const nextAttempt = row.attempt + 1;
    const delay = webhookBackoffMs(nextAttempt, this.backoffMs);
    row.status = 'failed';
    row.attempt = nextAttempt;
    row.nextAttemptAt = new Date(now.getTime() + delay);
    row.finishedAt = null;
    await this.attempts.save(row);
    return {
      attemptId: row.id,
      status: 'failed',
      attempt: row.attempt,
      responseStatus,
    };
  }
}
