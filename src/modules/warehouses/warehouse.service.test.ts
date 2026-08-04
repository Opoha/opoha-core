import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { WarehouseService } from './warehouse.service';

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  countryCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

describe('WarehouseService (unit)', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  let store: WarehouseRow[];
  let service: WarehouseService;
  let warehousesRepo: {
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
        id: 'wh-1',
        code: 'DEFAULT',
        name: 'Default warehouse',
        description: null,
        isActive: true,
        isDefault: true,
        addressLine1: null,
        addressLine2: null,
        city: null,
        province: null,
        postalCode: null,
        countryCode: null,
        createdAt: now,
        updatedAt: now,
      },
    ];

    warehousesRepo = {
      find: vi.fn(async () => [...store].sort((a, b) => a.code.localeCompare(b.code))),
      findOne: vi.fn(async ({ where }: { where: Partial<WarehouseRow> }) => {
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
      create: vi.fn((data: Partial<WarehouseRow>) => ({
        id: 'wh-new',
        description: null,
        isActive: true,
        isDefault: false,
        addressLine1: null,
        addressLine2: null,
        city: null,
        province: null,
        postalCode: null,
        countryCode: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: WarehouseRow) => {
        const idx = store.findIndex((r) => r.id === row.id);
        if (idx >= 0) {
          store[idx] = { ...row };
          return store[idx];
        }
        store.push({ ...row });
        return row;
      }),
      update: vi.fn(async (criteria: Partial<WarehouseRow>, patch: Partial<WarehouseRow>) => {
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
          getRepository: () => warehousesRepo,
        };
        return fn(manager);
      }),
    };

    eventBus = {
      publish: vi.fn(async () => undefined),
    };

    service = new WarehouseService(warehousesRepo as never, dataSource as never, eventBus as never);
  });

  it('lists warehouses ordered by code', async () => {
    const rows = await service.findAll();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.code).toBe('DEFAULT');
  });

  it('creates a warehouse and publishes WarehouseUpdated', async () => {
    const created = await service.create({
      code: ' NYC-01 ',
      name: ' New York ',
      isDefault: false,
      countryCode: 'us',
    });
    expect(created.code).toBe('NYC-01');
    expect(created.name).toBe('New York');
    expect(created.countryCode).toBe('US');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.WarehouseUpdated,
        data: expect.objectContaining({
          action: 'created',
          code: 'NYC-01',
        }),
      }),
    );
  });

  it('rejects empty code', async () => {
    await expect(service.create({ code: '   ', name: 'X' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('maps unique violations to ConflictException', async () => {
    const { QueryFailedError } = await import('typeorm');
    const qfe = new QueryFailedError('INSERT', [], {
      code: '23505',
    } as never);
    dataSource.transaction.mockRejectedValueOnce(qfe);

    await expect(service.create({ code: 'DEFAULT', name: 'Dup' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('finds default warehouse', async () => {
    const row = await service.findDefault();
    expect(row?.id).toBe('wh-1');
  });

  it('refuses deleting the default warehouse', async () => {
    await expect(service.remove('wh-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates and clears previous default when setting isDefault', async () => {
    store.push({
      id: 'wh-2',
      code: 'NYC',
      name: 'NYC',
      description: null,
      isActive: true,
      isDefault: false,
      addressLine1: null,
      addressLine2: null,
      city: null,
      province: null,
      postalCode: null,
      countryCode: null,
      createdAt: now,
      updatedAt: now,
    });

    const updated = await service.update('wh-2', { isDefault: true });
    expect(updated.isDefault).toBe(true);
    expect(store.find((r) => r.id === 'wh-1')?.isDefault).toBe(false);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.WarehouseUpdated,
        data: expect.objectContaining({ action: 'updated', warehouseId: 'wh-2' }),
      }),
    );
  });

  it('throws NotFound for missing id', async () => {
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
