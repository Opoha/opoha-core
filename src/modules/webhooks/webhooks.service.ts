import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { WebhookDeliveryAttemptEntity } from './entities/webhook-delivery-attempt.entity';
import { WebhookEndpointEntity } from './entities/webhook-endpoint.entity';
import type {
  CreateWebhookEndpointInput,
  UpdateWebhookEndpointInput,
  WebhookDeliveryAttemptType,
  WebhookEndpointType,
} from './webhooks.types';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function toEndpointType(row: WebhookEndpointEntity, maskSecret = false): WebhookEndpointType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    url: row.url,
    secret: maskSecret ? '***' : row.secret,
    eventNames: [...(row.eventNames ?? [])],
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAttemptType(row: WebhookDeliveryAttemptEntity): WebhookDeliveryAttemptType {
  return {
    id: row.id,
    endpointId: row.endpointId,
    eventName: row.eventName,
    eventId: row.eventId,
    payload: row.payload,
    status: row.status,
    attempt: row.attempt,
    nextAttemptAt: row.nextAttemptAt,
    responseStatus: row.responseStatus,
    responseBody: row.responseBody,
    errorMessage: row.errorMessage,
    signature: row.signature,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
  };
}

function normalizeCode(code: string): string {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) {
    throw new BadRequestException('code is required');
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(trimmed)) {
    throw new BadRequestException(
      'code must be 1–64 chars: lowercase alphanumeric, hyphen, underscore',
    );
  }
  return trimmed;
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new BadRequestException('name is required');
  }
  return trimmed;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new BadRequestException('url is required');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException('url must be a valid absolute URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BadRequestException('url must use http or https');
  }
  return trimmed;
}

function normalizeSecret(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length < 8) {
    throw new BadRequestException('secret must be at least 8 characters');
  }
  if (trimmed.length > 256) {
    throw new BadRequestException('secret must be at most 256 characters');
  }
  return trimmed;
}

function normalizeEventNames(eventNames: string[] | undefined): string[] {
  if (!eventNames || eventNames.length === 0) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of eventNames) {
    const name = raw.trim();
    if (!name) {
      continue;
    }
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    out.push(name);
  }
  return out;
}

/**
 * Webhook endpoint CRUD + delivery log reads.
 */
@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookEndpointEntity)
    private readonly endpoints: Repository<WebhookEndpointEntity>,
    @InjectRepository(WebhookDeliveryAttemptEntity)
    private readonly attempts: Repository<WebhookDeliveryAttemptEntity>,
  ) {}

  async findAll(opts?: { maskSecret?: boolean }): Promise<WebhookEndpointType[]> {
    const rows = await this.endpoints.find({
      order: { code: 'ASC' },
    });
    return rows.map((r) => toEndpointType(r, opts?.maskSecret ?? true));
  }

  async findById(id: string, opts?: { maskSecret?: boolean }): Promise<WebhookEndpointType> {
    const row = await this.endpoints.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Webhook endpoint "${id}" not found`);
    }
    return toEndpointType(row, opts?.maskSecret ?? true);
  }

  async findByCode(code: string, opts?: { maskSecret?: boolean }): Promise<WebhookEndpointType> {
    const row = await this.endpoints.findOne({
      where: { code: normalizeCode(code) },
    });
    if (!row) {
      throw new NotFoundException(`Webhook endpoint code "${code}" not found`);
    }
    return toEndpointType(row, opts?.maskSecret ?? true);
  }

  /** Enabled endpoints that subscribe to `eventName` (worker / dispatcher). */
  async findEnabledForEvent(eventName: string): Promise<WebhookEndpointEntity[]> {
    const rows = await this.endpoints.find({
      where: { enabled: true },
      order: { code: 'ASC' },
    });
    return rows.filter((r) => (r.eventNames ?? []).includes(eventName));
  }

  async create(input: CreateWebhookEndpointInput): Promise<WebhookEndpointType> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    const url = normalizeUrl(input.url);
    const secret = normalizeSecret(input.secret);
    const eventNames = normalizeEventNames(input.eventNames);
    const enabled = input.enabled ?? true;

    const existing = await this.endpoints.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`Webhook endpoint code "${code}" already exists`);
    }

    const row = this.endpoints.create({
      code,
      name,
      url,
      secret,
      eventNames,
      enabled,
    });

    try {
      const saved = await this.endpoints.save(row);
      // Return secret once on create so operators can copy it.
      return toEndpointType(saved, false);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Webhook endpoint code "${code}" already exists`);
      }
      throw error;
    }
  }

  async update(input: UpdateWebhookEndpointInput): Promise<WebhookEndpointType> {
    const row = await this.endpoints.findOne({ where: { id: input.id } });
    if (!row) {
      throw new NotFoundException(`Webhook endpoint "${input.id}" not found`);
    }

    if (input.code !== undefined) {
      row.code = normalizeCode(input.code);
    }
    if (input.name !== undefined) {
      row.name = normalizeName(input.name);
    }
    if (input.url !== undefined) {
      row.url = normalizeUrl(input.url);
    }
    if (input.secret !== undefined) {
      row.secret = normalizeSecret(input.secret);
    }
    if (input.eventNames !== undefined) {
      row.eventNames = normalizeEventNames(input.eventNames);
    }
    if (input.enabled !== undefined) {
      row.enabled = input.enabled;
    }

    try {
      const saved = await this.endpoints.save(row);
      return toEndpointType(saved, input.secret === undefined);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Webhook endpoint code "${row.code}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<WebhookEndpointType> {
    const row = await this.endpoints.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Webhook endpoint "${id}" not found`);
    }
    const snapshot = toEndpointType(row, true);
    await this.endpoints.remove(row);
    return snapshot;
  }

  async listDeliveryAttempts(
    endpointId: string,
    limit = 50,
  ): Promise<WebhookDeliveryAttemptType[]> {
    await this.findById(endpointId);
    const take = Math.min(Math.max(limit, 1), 200);
    const rows = await this.attempts.find({
      where: { endpointId },
      order: { createdAt: 'DESC' },
      take,
    });
    return rows.map(toAttemptType);
  }

  /** Test / gate helper — persist a raw endpoint without full validation. */
  async saveEndpointRaw(
    partial: Partial<WebhookEndpointEntity> & {
      code: string;
      name: string;
      url: string;
      secret: string;
    },
  ): Promise<WebhookEndpointEntity> {
    const row = this.endpoints.create({
      enabled: true,
      eventNames: [],
...partial,
    });
    return this.endpoints.save(row);
  }

  getAttemptsRepository(): Repository<WebhookDeliveryAttemptEntity> {
    return this.attempts;
  }

  getEndpointsRepository(): Repository<WebhookEndpointEntity> {
    return this.endpoints;
  }
}
