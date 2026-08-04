import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { StoreCurrencyConfigService } from './store-currency-config.service';
import type { StoreCurrencyConfigEntity } from './entities';

type ConfigRow = StoreCurrencyConfigEntity;

describe('StoreCurrencyConfigService (unit)', () => {
  const storeId = '11111111-1111-4111-8111-111111111111';
  const now = new Date('2026-08-04T00:00:00Z');
  let rows: ConfigRow[];
  let service: StoreCurrencyConfigService;
  let configsRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let stores: { findById: ReturnType<typeof vi.fn> };
  let eventBus: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    rows = [];
    configsRepo = {
      find: vi.fn(async () => [...rows]),
      findOne: vi.fn(async ({ where }: { where: { storeId: string } }) => {
        return rows.find((r) => r.storeId === where.storeId) ?? null;
      }),
      create: vi.fn((data: Partial<ConfigRow>) => ({
        storeId,
        settlementCurrencyCode: 'USD',
        displayCurrencyCode: 'USD',
        enabledDisplayCurrencies: ['USD'],
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: ConfigRow) => {
        const idx = rows.findIndex((r) => r.storeId === row.storeId);
        const saved = { ...row, updatedAt: now };
        if (idx >= 0) {
          rows[idx] = saved;
        } else {
          rows.push(saved);
        }
        return saved;
      }),
    };
    stores = {
      findById: vi.fn(async (id: string) => {
        if (id !== storeId) {
          throw new NotFoundException(`Store ${id} not found`);
        }
        return { id, defaultCurrencyCode: 'USD' };
      }),
    };
    eventBus = { publish: vi.fn(async () => undefined) };
    service = new StoreCurrencyConfigService(
      configsRepo as never,
      stores as never,
      eventBus as never,
    );
  });

  it('creates defaults from store defaultCurrencyCode on first getForStore', async () => {
    const result = await service.getForStore(storeId);
    expect(result.storeId).toBe(storeId);
    expect(result.settlementCurrencyCode).toBe('USD');
    expect(result.displayCurrencyCode).toBe('USD');
    expect(result.enabledDisplayCurrencies).toEqual(['USD']);
    expect(rows).toHaveLength(1);
  });

  it('rejects unknown store', async () => {
    await expect(
      service.getForStore('99999999-9999-4999-8999-999999999999'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('separates display vs settlement and publishes event', async () => {
    await service.getForStore(storeId);
    const updated = await service.update(storeId, {
      settlementCurrencyCode: 'usd',
      displayCurrencyCode: 'eur',
      enabledDisplayCurrencies: ['gbp', 'eur'],
    });
    expect(updated.settlementCurrencyCode).toBe('USD');
    expect(updated.displayCurrencyCode).toBe('EUR');
    expect(updated.enabledDisplayCurrencies).toEqual(['EUR', 'GBP']);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.StoreCurrencyConfigUpdated,
        aggregateId: storeId,
        data: expect.objectContaining({
          settlementCurrencyCode: 'USD',
          displayCurrencyCode: 'EUR',
          enabledDisplayCurrencies: ['EUR', 'GBP'],
        }),
      }),
    );
  });

  it('always includes primary display in enabled list', async () => {
    await service.getForStore(storeId);
    const updated = await service.update(storeId, {
      displayCurrencyCode: 'JPY',
      enabledDisplayCurrencies: ['EUR'],
    });
    expect(updated.displayCurrencyCode).toBe('JPY');
    expect(updated.enabledDisplayCurrencies).toEqual(['EUR', 'JPY']);
  });

  it('rejects invalid currency codes', async () => {
    await service.getForStore(storeId);
    await expect(service.update(storeId, { settlementCurrencyCode: 'US' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.update(storeId, { displayCurrencyCode: 'EURO' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.update(storeId, { enabledDisplayCurrencies: ['USD', 'XXXX'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('isDisplayCurrencyAllowed checks primary + enabled list', async () => {
    await service.update(storeId, {
      displayCurrencyCode: 'USD',
      enabledDisplayCurrencies: ['EUR'],
    });
    expect(await service.isDisplayCurrencyAllowed(storeId, 'usd')).toBe(true);
    expect(await service.isDisplayCurrencyAllowed(storeId, 'EUR')).toBe(true);
    expect(await service.isDisplayCurrencyAllowed(storeId, 'GBP')).toBe(false);
  });

  it('isolates config per store id', async () => {
    const otherId = '22222222-2222-4222-8222-222222222222';
    stores.findById = vi.fn(async (id: string) => {
      if (id !== storeId && id !== otherId) {
        throw new NotFoundException(`Store ${id} not found`);
      }
      return {
        id,
        defaultCurrencyCode: id === otherId ? 'EUR' : 'USD',
      };
    });
    await service.update(storeId, {
      settlementCurrencyCode: 'USD',
      displayCurrencyCode: 'USD',
    });
    await service.update(otherId, {
      settlementCurrencyCode: 'EUR',
      displayCurrencyCode: 'GBP',
      enabledDisplayCurrencies: ['GBP'],
    });
    const a = await service.getForStore(storeId);
    const b = await service.getForStore(otherId);
    expect(a.settlementCurrencyCode).toBe('USD');
    expect(b.settlementCurrencyCode).toBe('EUR');
    expect(b.displayCurrencyCode).toBe('GBP');
    expect(await service.findAll()).toHaveLength(2);
  });
});
