import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { CoreEventName } from '../event-bus/event-catalog';
import { EventBusService } from '../event-bus/event-bus.service';
import { ExchangeRateEntity } from './entities';
import type {
  CreateExchangeRateInput,
  ExchangeRateType,
  UpdateExchangeRateInput,
} from './exchange-rate.types';
import { FXRateProviderRegistry } from './fx-rate-provider.registry';

const CURRENCY_RE = /^[A-Z]{3}$/;
const DEFAULT_SOURCE = 'manual';

function assertCurrencyCode(value: string, field: string): string {
  const normalized = value.trim().toUpperCase();
  if (!CURRENCY_RE.test(normalized)) {
    throw new BadRequestException(`Invalid ${field} "${value}" (expected ISO 4217)`);
  }
  return normalized;
}

function assertRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new BadRequestException('rate must be a finite number greater than 0');
  }
  return value;
}

function assertSource(value: string | undefined): string {
  const source = (value ?? DEFAULT_SOURCE).trim();
  if (!source) {
    throw new BadRequestException('source must be a non-empty string');
  }
  return source;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    (error.driverError as { code: string }).code === '23505'
  );
}

function toType(row: ExchangeRateEntity): ExchangeRateType {
  return {
    id: row.id,
    fromCurrencyCode: row.fromCurrencyCode,
    toCurrencyCode: row.toCurrencyCode,
    rate: row.rate,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class ExchangeRateService {
  constructor(
    @InjectRepository(ExchangeRateEntity)
    private readonly rates: Repository<ExchangeRateEntity>,
    private readonly eventBus: EventBusService,
    private readonly fxProviders: FXRateProviderRegistry,
  ) {}

  async findAll(filters?: {
    fromCurrencyCode?: string;
    toCurrencyCode?: string;
  }): Promise<ExchangeRateType[]> {
    const where: {
      fromCurrencyCode?: string;
      toCurrencyCode?: string;
    } = {};
    if (filters?.fromCurrencyCode) {
      where.fromCurrencyCode = assertCurrencyCode(filters.fromCurrencyCode, 'fromCurrencyCode');
    }
    if (filters?.toCurrencyCode) {
      where.toCurrencyCode = assertCurrencyCode(filters.toCurrencyCode, 'toCurrencyCode');
    }
    const rows = await this.rates.find({
      where: Object.keys(where).length > 0 ? where : undefined,
      order: { fromCurrencyCode: 'ASC', toCurrencyCode: 'ASC' },
    });
    return rows.map(toType);
  }

  async findById(id: string): Promise<ExchangeRateType> {
    const row = await this.rates.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Exchange rate ${id} not found`);
    }
    return toType(row);
  }

  /**
   * Lookup rate for a currency pair. Same-currency returns 1 without a row.
 * Throws when a cross-currency rate is missing (consumers should catch).
   */
  async getRate(fromCurrencyCode: string, toCurrencyCode: string): Promise<number> {
    const from = assertCurrencyCode(fromCurrencyCode, 'fromCurrencyCode');
    const to = assertCurrencyCode(toCurrencyCode, 'toCurrencyCode');
    if (from === to) {
      return 1;
    }
    const row = await this.rates.findOne({
      where: { fromCurrencyCode: from, toCurrencyCode: to },
    });
    if (!row) {
      throw new NotFoundException(`Exchange rate ${from}→${to} not found`);
    }
    return row.rate;
  }

  async create(input: CreateExchangeRateInput): Promise<ExchangeRateType> {
    const fromCurrencyCode = assertCurrencyCode(input.fromCurrencyCode, 'fromCurrencyCode');
    const toCurrencyCode = assertCurrencyCode(input.toCurrencyCode, 'toCurrencyCode');
    if (fromCurrencyCode === toCurrencyCode) {
      throw new BadRequestException('fromCurrencyCode and toCurrencyCode must differ');
    }
    const rate = assertRate(input.rate);
    const source = assertSource(input.source);

    const created = this.rates.create({
      fromCurrencyCode,
      toCurrencyCode,
      rate,
      source,
    });

    let saved: ExchangeRateEntity;
    try {
      saved = await this.rates.save(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Exchange rate ${fromCurrencyCode}→${toCurrencyCode} already exists`,
        );
      }
      throw error;
    }

    await this.publishUpdated(saved);
    return toType(saved);
  }

  async update(id: string, input: UpdateExchangeRateInput): Promise<ExchangeRateType> {
    const row = await this.rates.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Exchange rate ${id} not found`);
    }

    if (input.rate !== undefined) {
      row.rate = assertRate(input.rate);
    }
    if (input.source !== undefined) {
      row.source = assertSource(input.source);
    }

    const saved = await this.rates.save(row);
    await this.publishUpdated(saved);
    return toType(saved);
  }

  /**
   * Create or update by currency pair (admin convenience; still publishes
   * ExchangeRateUpdated).
   */
  async upsert(input: CreateExchangeRateInput): Promise<ExchangeRateType> {
    const fromCurrencyCode = assertCurrencyCode(input.fromCurrencyCode, 'fromCurrencyCode');
    const toCurrencyCode = assertCurrencyCode(input.toCurrencyCode, 'toCurrencyCode');
    if (fromCurrencyCode === toCurrencyCode) {
      throw new BadRequestException('fromCurrencyCode and toCurrencyCode must differ');
    }
    const rate = assertRate(input.rate);
    const source = assertSource(input.source);

    const existing = await this.rates.findOne({
      where: { fromCurrencyCode, toCurrencyCode },
    });
    if (existing) {
      existing.rate = rate;
      existing.source = source;
      const saved = await this.rates.save(existing);
      await this.publishUpdated(saved);
      return toType(saved);
    }

    return this.create({
      fromCurrencyCode,
      toCurrencyCode,
      rate,
      source,
    });
  }

  async remove(id: string): Promise<ExchangeRateType> {
    const row = await this.rates.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Exchange rate ${id} not found`);
    }
    const snapshot = toType(row);
    await this.rates.remove(row);

    await this.eventBus.publish({
      eventName: CoreEventName.ExchangeRateUpdated,
      aggregateType: 'exchange_rate',
      aggregateId: snapshot.id,
      data: {
        id: snapshot.id,
        fromCurrencyCode: snapshot.fromCurrencyCode,
        toCurrencyCode: snapshot.toCurrencyCode,
        rate: null,
        source: snapshot.source,
        deleted: true,
      },
    });

    return snapshot;
  }

  /**
   * Fetch live quotes from a registered FX provider and upsert them as
 * manual-equivalent rows with `source` set to the provider code.
   * Optional — core never calls a provider SDK directly; the registered
   * provider object (registered by a plugin) is the only bridge.
   */
  async syncFromProvider(
    providerCode: string,
    pairs: Array<{ fromCurrencyCode: string; toCurrencyCode: string }>,
  ): Promise<ExchangeRateType[]> {
    if (!providerCode?.trim()) {
      throw new BadRequestException('providerCode must be a non-empty string');
    }
    if (!pairs || pairs.length === 0) {
      throw new BadRequestException('pairs must contain at least one currency pair');
    }
    const provider = this.fxProviders.get(providerCode.trim());
    if (!provider) {
      throw new NotFoundException(`FX provider "${providerCode}" is not registered or inactive`);
    }

    const results: ExchangeRateType[] = [];
    for (const pair of pairs) {
      const fromCurrencyCode = assertCurrencyCode(pair.fromCurrencyCode, 'fromCurrencyCode');
      const toCurrencyCode = assertCurrencyCode(pair.toCurrencyCode, 'toCurrencyCode');
      const quote = await provider.getRate({ fromCurrencyCode, toCurrencyCode });
      const saved = await this.upsert({
        fromCurrencyCode,
        toCurrencyCode,
        rate: assertRate(quote.rate),
        source: provider.code,
      });
      results.push(saved);
    }
    return results;
  }

  private async publishUpdated(row: ExchangeRateEntity): Promise<void> {
    await this.eventBus.publish({
      eventName: CoreEventName.ExchangeRateUpdated,
      aggregateType: 'exchange_rate',
      aggregateId: row.id,
      data: {
        id: row.id,
        fromCurrencyCode: row.fromCurrencyCode,
        toCurrencyCode: row.toCurrencyCode,
        rate: row.rate,
        source: row.source,
        deleted: false,
      },
    });
  }
}
