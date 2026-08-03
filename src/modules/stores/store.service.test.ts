import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { StoreService } from './store.service';

type StoreRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  defaultCurrencyCode: string;
  defaultLocale: string;
  createdAt: Date;
  updatedAt: Date;
};

describe('StoreService (unit)', () => {
  const now = new Date('2026-08-03T18:00:00Z');
  let store: StoreRow[];
  let service: StoreService;
  let storesRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let eventBus: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    store = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        code: 'DEFAULT',
        name: 'Default store',
        description: null,
        isActive: true,
        isDefault: true,
        defaultCurrencyCode: 'USD',
        defaultLocale: 'en-US',
        createdAt: now,
        updatedAt: now,
      },
    ];

    storesRepo = {
      find: vi.fn(async () => [...store].sort((a, b) => a.code.localeCompare(b.code))),
      findOne: vi.fn(async ({ where }: { where: Partial<StoreRow> }) => {
        if (where.id) {
          return store.find((r) => r.id === where.id) ?? null;
        }
        if (where.code) {
          return store.find((r) => r.code === where.code) ?? null;
        }
        if (where.isDefault === true) {
          return store.find((r) => r.isDefault) ?? null;
        }
        return null;
      }),
      create: vi.fn((data: Partial<StoreRow>) => ({
        id: '22222222-2222-4222-8222-222222222222',
        description: null,
        isActive: true,
        isDefault: false,
        defaultCurrencyCode: 'USD',
        defaultLocale: 'en-US',
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: StoreRow) => {
        const idx = store.findIndex((r) => r.id === row.id);
        if (idx >= 0) {
          store[idx] = { ...row };
          return store[idx];
        }
        store.push({ ...row });
        return row;
      }),
      update: vi.fn(async (criteria: Partial<StoreRow>, patch: Partial<StoreRow>) => {
        for (const row of store) {
          if (criteria.isDefault === true && row.isDefault) {
            Object.assign(row, patch);
          }
        }
      }),
      delete: vi.fn(async ({ id }: { id: string }) => {
        store = store.filter((r) => r.id !== id);
      }),
    };

    dataSource = {
      transaction: vi.fn(async (fn: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          getRepository: () => storesRepo,
        };
        return fn(manager);
      }),
    };

    eventBus = {
      publish: vi.fn(async () => undefined),
    };

    service = new StoreService(
      storesRepo as never,
      dataSource as never,
      eventBus as never,
    );
  });

  it('lists stores ordered by code', async () => {
    const rows = await service.findAll();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.code).toBe('DEFAULT');
  });

  it('creates a store and publishes StoreCreated', async () => {
    const created = await service.create({
      code: ' US-WEB ',
      name: ' US Web ',
      defaultCurrencyCode: 'usd',
      defaultLocale: 'en-US',
      isDefault: false,
    });
    expect(created.code).toBe('US-WEB');
    expect(created.name).toBe('US Web');
    expect(created.defaultCurrencyCode).toBe('USD');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.StoreCreated,
        data: expect.objectContaining({
          code: 'US-WEB',
          defaultCurrencyCode: 'USD',
        }),
      }),
    );
  });

  it('updates a store and publishes StoreUpdated', async () => {
    const updated = await service.update(store[0]!.id, {
      name: ' Renamed ',
      defaultLocale: 'th-TH',
    });
    expect(updated.name).toBe('Renamed');
    expect(updated.defaultLocale).toBe('th-TH');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.StoreUpdated,
        data: expect.objectContaining({
          name: 'Renamed',
          defaultLocale: 'th-TH',
        }),
      }),
    );
  });

  it('rejects empty code', async () => {
    await expect(
      service.create({
        code: '   ',
        name: 'X',
        defaultCurrencyCode: 'USD',
        defaultLocale: 'en-US',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid currency / locale', async () => {
    await expect(
      service.create({
        code: 'BAD',
        name: 'Bad',
        defaultCurrencyCode: 'US',
        defaultLocale: 'en-US',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({
        code: 'BAD2',
        name: 'Bad',
        defaultCurrencyCode: 'USD',
        defaultLocale: 'ENGLISH',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cannot delete the default store', async () => {
    await expect(service.remove(store[0]!.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns not found for missing id', async () => {
    await expect(
      service.findById('99999999-9999-4999-8999-999999999999'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('surfaces unique code conflicts', async () => {
    const { QueryFailedError } = await import('typeorm');
    const err = new QueryFailedError('INSERT', [], new Error('duplicate'));
    Object.assign(err, { driverError: { code: '23505' } });
    dataSource.transaction.mockRejectedValueOnce(err);

    await expect(
      service.create({
        code: 'DEFAULT',
        name: 'Dup',
        defaultCurrencyCode: 'USD',
        defaultLocale: 'en-US',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
