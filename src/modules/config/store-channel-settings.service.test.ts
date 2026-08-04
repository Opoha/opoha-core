import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { StoreChannelSettingsService } from './store-channel-settings.service';
import type { StoreChannelSettingsEntity } from './entities';

type SettingsRow = StoreChannelSettingsEntity;

describe('StoreChannelSettingsService (unit)', () => {
  const storeId = '11111111-1111-4111-8111-111111111111';
  const now = new Date('2026-08-03T18:00:00Z');
  let rows: SettingsRow[];
  let service: StoreChannelSettingsService;
  let settingsRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let stores: { findById: ReturnType<typeof vi.fn> };
  let eventBus: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    rows = [];
    settingsRepo = {
      find: vi.fn(async () => [...rows]),
      findOne: vi.fn(async ({ where }: { where: { storeId: string } }) => {
        return rows.find((r) => r.storeId === where.storeId) ?? null;
      }),
      create: vi.fn((data: Partial<SettingsRow>) => ({
        storeId,
        timezone: 'UTC',
        countryCode: 'US',
        catalogMode: 'shared' as const,
        settingsJson: {},
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: SettingsRow) => {
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
        return { id };
      }),
    };
    eventBus = { publish: vi.fn(async () => undefined) };
    service = new StoreChannelSettingsService(
      settingsRepo as never,
      stores as never,
      eventBus as never,
    );
  });

  it('creates defaults on first getForStore', async () => {
    const result = await service.getForStore(storeId);
    expect(result.storeId).toBe(storeId);
    expect(result.timezone).toBe('UTC');
    expect(result.countryCode).toBe('US');
    expect(result.catalogMode).toBe('shared');
    expect(result.settingsJson).toBe('{}');
    expect(rows).toHaveLength(1);
  });

  it('rejects unknown store', async () => {
    await expect(
      service.getForStore('99999999-9999-4999-8999-999999999999'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates channel settings and publishes event', async () => {
    await service.getForStore(storeId);
    const updated = await service.update(storeId, {
      timezone: 'America/New_York',
      countryCode: 'ca',
      catalogMode: 'isolated',
      settingsJson: '{"theme":"dark"}',
    });
    expect(updated.timezone).toBe('America/New_York');
    expect(updated.countryCode).toBe('CA');
    expect(updated.catalogMode).toBe('isolated');
    expect(JSON.parse(updated.settingsJson)).toEqual({ theme: 'dark' });
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.StoreChannelSettingsUpdated,
        aggregateId: storeId,
        data: expect.objectContaining({
          catalogMode: 'isolated',
          countryCode: 'CA',
          timezone: 'America/New_York',
        }),
      }),
    );
  });

  it('rejects invalid timezone / country / catalogMode / settingsJson', async () => {
    await service.getForStore(storeId);
    await expect(service.update(storeId, { timezone: 'Not/AZone' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.update(storeId, { countryCode: 'USA' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.update(storeId, { catalogMode: 'hybrid' as never }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update(storeId, { settingsJson: '[]' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('isolates settings per store id', async () => {
    const otherId = '22222222-2222-4222-8222-222222222222';
    stores.findById = vi.fn(async (id: string) => {
      if (id !== storeId && id !== otherId) {
        throw new NotFoundException(`Store ${id} not found`);
      }
      return { id };
    });
    await service.update(storeId, { catalogMode: 'shared' });
    await service.update(otherId, { catalogMode: 'isolated' });
    const a = await service.getForStore(storeId);
    const b = await service.getForStore(otherId);
    expect(a.catalogMode).toBe('shared');
    expect(b.catalogMode).toBe('isolated');
    expect(await service.findAll()).toHaveLength(2);
  });
});
