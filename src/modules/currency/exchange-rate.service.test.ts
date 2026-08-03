import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { ExchangeRateService } from './exchange-rate.service';
import { FXRateProviderRegistry } from './fx-rate-provider.registry';
import type { ExchangeRateEntity } from './entities';
import type { FXRateProvider } from './fx-rate-provider';

type RateRow = ExchangeRateEntity;

describe('ExchangeRateService (unit)', () => {
  const now = new Date('2026-08-04T00:00:00Z');
  let rows: RateRow[];
  let service: ExchangeRateService;
  let ratesRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let eventBus: { publish: ReturnType<typeof vi.fn> };
  let fxProviders: FXRateProviderRegistry;
  let nextId: number;

  beforeEach(() => {
    rows = [];
    nextId = 1;
    ratesRepo = {
      find: vi.fn(async ({ where }: { where?: Partial<RateRow> } = {}) => {
        let result = [...rows];
        if (where?.fromCurrencyCode) {
          result = result.filter(
            (r) => r.fromCurrencyCode === where.fromCurrencyCode,
          );
        }
        if (where?.toCurrencyCode) {
          result = result.filter(
            (r) => r.toCurrencyCode === where.toCurrencyCode,
          );
        }
        return result.sort((a, b) =>
          `${a.fromCurrencyCode}${a.toCurrencyCode}`.localeCompare(
            `${b.fromCurrencyCode}${b.toCurrencyCode}`,
          ),
        );
      }),
      findOne: vi.fn(
        async ({
          where,
        }: {
          where: { id?: string; fromCurrencyCode?: string; toCurrencyCode?: string };
        }) => {
          if (where.id) {
            return rows.find((r) => r.id === where.id) ?? null;
          }
          return (
            rows.find(
              (r) =>
                r.fromCurrencyCode === where.fromCurrencyCode &&
                r.toCurrencyCode === where.toCurrencyCode,
            ) ?? null
          );
        },
      ),
      create: vi.fn((data: Partial<RateRow>) => ({
        id: `00000000-0000-4000-8000-${String(nextId).padStart(12, '0')}`,
        fromCurrencyCode: 'USD',
        toCurrencyCode: 'EUR',
        rate: 1,
        source: 'manual',
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: RateRow) => {
        const idx = rows.findIndex((r) => r.id === row.id);
        const saved = { ...row, updatedAt: now };
        if (idx >= 0) {
          const dup = rows.find(
            (r) =>
              r.id !== saved.id &&
              r.fromCurrencyCode === saved.fromCurrencyCode &&
              r.toCurrencyCode === saved.toCurrencyCode,
          );
          if (dup) {
            throw new QueryFailedError('INSERT', [], { code: '23505' } as never);
          }
          rows[idx] = saved;
        } else {
          const dup = rows.find(
            (r) =>
              r.fromCurrencyCode === saved.fromCurrencyCode &&
              r.toCurrencyCode === saved.toCurrencyCode,
          );
          if (dup) {
            throw new QueryFailedError('INSERT', [], { code: '23505' } as never);
          }
          if (!saved.id.startsWith('00000000')) {
            saved.id = `00000000-0000-4000-8000-${String(nextId).padStart(12, '0')}`;
          }
          nextId += 1;
          rows.push(saved);
        }
        return saved;
      }),
      remove: vi.fn(async (row: RateRow) => {
        rows = rows.filter((r) => r.id !== row.id);
        return row;
      }),
    };
    eventBus = { publish: vi.fn(async () => undefined) };
    fxProviders = new FXRateProviderRegistry();
    service = new ExchangeRateService(
      ratesRepo as never,
      eventBus as never,
      fxProviders,
    );
  });

  it('creates a manual rate and publishes ExchangeRateUpdated', async () => {
    const created = await service.create({
      fromCurrencyCode: 'usd',
      toCurrencyCode: 'eur',
      rate: 0.92,
    });
    expect(created.fromCurrencyCode).toBe('USD');
    expect(created.toCurrencyCode).toBe('EUR');
    expect(created.rate).toBe(0.92);
    expect(created.source).toBe('manual');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.ExchangeRateUpdated,
        data: expect.objectContaining({
          fromCurrencyCode: 'USD',
          toCurrencyCode: 'EUR',
          rate: 0.92,
          deleted: false,
        }),
      }),
    );
  });

  it('rejects invalid codes, same-currency pairs, and non-positive rates', async () => {
    await expect(
      service.create({
        fromCurrencyCode: 'US',
        toCurrencyCode: 'EUR',
        rate: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({
        fromCurrencyCode: 'USD',
        toCurrencyCode: 'USD',
        rate: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({
        fromCurrencyCode: 'USD',
        toCurrencyCode: 'EUR',
        rate: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate currency pairs', async () => {
    await service.create({
      fromCurrencyCode: 'USD',
      toCurrencyCode: 'EUR',
      rate: 0.9,
    });
    await expect(
      service.create({
        fromCurrencyCode: 'USD',
        toCurrencyCode: 'EUR',
        rate: 0.91,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates rate and upserts by pair', async () => {
    const created = await service.create({
      fromCurrencyCode: 'USD',
      toCurrencyCode: 'JPY',
      rate: 150,
    });
    const updated = await service.update(created.id, { rate: 151.5 });
    expect(updated.rate).toBe(151.5);

    const upserted = await service.upsert({
      fromCurrencyCode: 'USD',
      toCurrencyCode: 'JPY',
      rate: 152,
      source: 'manual',
    });
    expect(upserted.id).toBe(created.id);
    expect(upserted.rate).toBe(152);
    expect(await service.findAll()).toHaveLength(1);
  });

  it('getRate returns 1 for identity and looks up configured pairs', async () => {
    expect(await service.getRate('USD', 'usd')).toBe(1);
    await service.create({
      fromCurrencyCode: 'USD',
      toCurrencyCode: 'EUR',
      rate: 0.85,
    });
    expect(await service.getRate('USD', 'EUR')).toBe(0.85);
    await expect(service.getRate('EUR', 'USD')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes a rate and publishes deleted ExchangeRateUpdated', async () => {
    const created = await service.create({
      fromCurrencyCode: 'GBP',
      toCurrencyCode: 'USD',
      rate: 1.27,
    });
    const removed = await service.remove(created.id);
    expect(removed.id).toBe(created.id);
    expect(rows).toHaveLength(0);
    expect(eventBus.publish).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.ExchangeRateUpdated,
        data: expect.objectContaining({
          id: created.id,
          rate: null,
          deleted: true,
        }),
      }),
    );
  });

  it('filters findAll by from/to', async () => {
    await service.create({
      fromCurrencyCode: 'USD',
      toCurrencyCode: 'EUR',
      rate: 0.9,
    });
    await service.create({
      fromCurrencyCode: 'USD',
      toCurrencyCode: 'GBP',
      rate: 0.8,
    });
    await service.create({
      fromCurrencyCode: 'EUR',
      toCurrencyCode: 'USD',
      rate: 1.1,
    });
    const usd = await service.findAll({ fromCurrencyCode: 'USD' });
    expect(usd).toHaveLength(2);
    const pair = await service.findAll({
      fromCurrencyCode: 'EUR',
      toCurrencyCode: 'USD',
    });
    expect(pair).toHaveLength(1);
    expect(pair[0]?.rate).toBe(1.1);
  });

  describe('syncFromProvider (D-04)', () => {
    const provider: FXRateProvider = {
      code: 'openexchangerates',
      displayName: 'Open Exchange Rates',
      getRate: vi.fn(async ({ fromCurrencyCode, toCurrencyCode }) => {
        if (fromCurrencyCode === 'USD' && toCurrencyCode === 'EUR') {
          return { rate: 0.93, asOf: '2026-08-04T00:00:00Z' };
        }
        return { rate: 1 };
      }),
    };

    it('rejects an unregistered provider', async () => {
      await expect(
        service.syncFromProvider('missing', [
          { fromCurrencyCode: 'USD', toCurrencyCode: 'EUR' },
        ]),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an empty pairs list', async () => {
      fxProviders.register('fx-plugin', provider);
      await expect(
        service.syncFromProvider('openexchangerates', []),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('fetches quotes from the registered provider and upserts as source=providerCode', async () => {
      fxProviders.register('fx-plugin', provider);

      const [synced] = await service.syncFromProvider('openexchangerates', [
        { fromCurrencyCode: 'usd', toCurrencyCode: 'eur' },
      ]);

      expect(provider.getRate).toHaveBeenCalledWith({
        fromCurrencyCode: 'USD',
        toCurrencyCode: 'EUR',
      });
      expect(synced?.rate).toBe(0.93);
      expect(synced?.source).toBe('openexchangerates');
      expect(await service.getRate('USD', 'EUR')).toBe(0.93);
    });

    it('ignores an inactive provider', async () => {
      fxProviders.register('fx-plugin', provider);
      fxProviders.deactivatePlugin('fx-plugin');
      await expect(
        service.syncFromProvider('openexchangerates', [
          { fromCurrencyCode: 'USD', toCurrencyCode: 'EUR' },
        ]),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
