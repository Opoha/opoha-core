import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { StoreWarehouseService } from './store-warehouse.service';

type LinkRow = {
  storeId: string;
  warehouseId: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type WarehouseRow = {
  id: string;
  isDefault: boolean;
};

describe('StoreWarehouseService (unit)', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  let links: LinkRow[];
  let warehouses: WarehouseRow[];
  let service: StoreWarehouseService;
  let linksRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  let warehousesRepo: { findOne: ReturnType<typeof vi.fn> };
  let stores: { findById: ReturnType<typeof vi.fn> };
  let warehouseService: { findById: ReturnType<typeof vi.fn> };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let eventBus: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    links = [
      {
        storeId: 'store-1',
        warehouseId: 'wh-1',
        isPrimary: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
    warehouses = [
      { id: 'wh-1', isDefault: true },
      { id: 'wh-2', isDefault: false },
    ];

    linksRepo = {
      find: vi.fn(async ({ where }: { where: Partial<LinkRow> }) =>
        links
          .filter((r) => {
            if (where.storeId && r.storeId !== where.storeId) return false;
            if (where.warehouseId && r.warehouseId !== where.warehouseId) {
              return false;
            }
            return true;
          })
          .sort((a, b) => {
            if (a.isPrimary !== b.isPrimary) {
              return a.isPrimary ? -1 : 1;
            }
            return a.warehouseId.localeCompare(b.warehouseId);
          }),
      ),
      findOne: vi.fn(async ({ where }: { where: Partial<LinkRow> }) => {
        return (
          links.find((r) => {
            if (where.storeId && r.storeId !== where.storeId) return false;
            if (where.warehouseId && r.warehouseId !== where.warehouseId) {
              return false;
            }
            if (where.isPrimary === true && !r.isPrimary) return false;
            return true;
          }) ?? null
        );
      }),
      create: vi.fn((data: Partial<LinkRow>) => ({
        createdAt: now,
        updatedAt: now,
        isPrimary: false,
        ...data,
      })),
      save: vi.fn(async (row: LinkRow) => {
        const idx = links.findIndex(
          (r) =>
            r.storeId === row.storeId && r.warehouseId === row.warehouseId,
        );
        if (idx >= 0) {
          links[idx] = { ...row };
          return links[idx];
        }
        links.push({ ...row });
        return row;
      }),
      update: vi.fn(
        async (
          where: Partial<LinkRow>,
          patch: Partial<LinkRow>,
        ) => {
          for (const row of links) {
            if (where.storeId && row.storeId !== where.storeId) continue;
            if (where.isPrimary === true && !row.isPrimary) continue;
            Object.assign(row, patch);
          }
        },
      ),
      delete: vi.fn(async (where: Partial<LinkRow>) => {
        links = links.filter(
          (r) =>
            !(
              r.storeId === where.storeId &&
              r.warehouseId === where.warehouseId
            ),
        );
      }),
      count: vi.fn(async ({ where }: { where: Partial<LinkRow> }) =>
        links.filter((r) => !where.storeId || r.storeId === where.storeId)
          .length,
      ),
    };

    warehousesRepo = {
      findOne: vi.fn(async ({ where }: { where: Partial<WarehouseRow> }) => {
        if (where.id) {
          return warehouses.find((w) => w.id === where.id) ?? null;
        }
        if (where.isDefault === true) {
          return warehouses.find((w) => w.isDefault) ?? null;
        }
        return null;
      }),
    };

    stores = {
      findById: vi.fn(async (id: string) => {
        if (id === 'missing') {
          throw new NotFoundException(`Store ${id} not found`);
        }
        return { id };
      }),
    };

    warehouseService = {
      findById: vi.fn(async (id: string) => ({
        id,
        code: id === 'wh-1' ? 'DEFAULT' : 'SEC',
        name: id,
        description: null,
        isActive: true,
        isDefault: id === 'wh-1',
        addressLine1: null,
        addressLine2: null,
        city: null,
        province: null,
        postalCode: null,
        countryCode: null,
        createdAt: now,
        updatedAt: now,
      })),
    };

    dataSource = {
      transaction: vi.fn(async (fn: (m: unknown) => Promise<unknown>) =>
        fn({
          getRepository: () => linksRepo,
        }),
      ),
    };

    eventBus = { publish: vi.fn(async () => undefined) };

    service = new StoreWarehouseService(
      linksRepo as never,
      warehousesRepo as never,
      stores as never,
      warehouseService as never,
      dataSource as never,
      eventBus as never,
    );
  });

  it('lists associations for a store', async () => {
    const rows = await service.listForStore('store-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.warehouseId).toBe('wh-1');
    expect(rows[0]?.isPrimary).toBe(true);
  });

  it('asserts warehouse allowed / rejected', async () => {
    await expect(
      service.assertWarehouseAllowedForStore('store-1', 'wh-1'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertWarehouseAllowedForStore('store-1', 'wh-2'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('links a secondary warehouse and can promote primary', async () => {
    const linked = await service.link('store-1', 'wh-2', true);
    expect(linked.isPrimary).toBe(true);
    expect(links.find((r) => r.warehouseId === 'wh-1')?.isPrimary).toBe(false);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.StoreWarehouseUpdated,
        data: expect.objectContaining({
          action: 'linked',
          warehouseId: 'wh-2',
          isPrimary: true,
        }),
      }),
    );
  });

  it('unlinks and promotes remaining primary', async () => {
    await service.link('store-1', 'wh-2', false);
    const removed = await service.unlink('store-1', 'wh-1');
    expect(removed.warehouseId).toBe('wh-1');
    expect(links).toHaveLength(1);
    expect(links[0]?.warehouseId).toBe('wh-2');
    expect(links[0]?.isPrimary).toBe(true);
  });

  it('ensureDefaultForStore links default when empty', async () => {
    links = [];
    const row = await service.ensureDefaultForStore('store-2');
    expect(row?.warehouseId).toBe('wh-1');
    expect(row?.isPrimary).toBe(true);
  });

  it('resolvePrimaryWarehouseId prefers primary', async () => {
    await service.link('store-1', 'wh-2', false);
    await expect(service.resolvePrimaryWarehouseId('store-1')).resolves.toBe(
      'wh-1',
    );
  });

  it('assertTransferAllowed rejects warehouses with no shared store', async () => {
    links = [
      {
        storeId: 'store-1',
        warehouseId: 'wh-1',
        isPrimary: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        storeId: 'store-2',
        warehouseId: 'wh-2',
        isPrimary: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
    await expect(
      service.assertTransferAllowed('wh-1', 'wh-2'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assertTransferAllowed accepts when storeId scopes both warehouses', async () => {
    links = [
      {
        storeId: 'store-1',
        warehouseId: 'wh-1',
        isPrimary: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        storeId: 'store-1',
        warehouseId: 'wh-2',
        isPrimary: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
    await expect(
      service.assertTransferAllowed('wh-1', 'wh-2', 'store-1'),
    ).resolves.toBeUndefined();
  });

  it('rejects unknown warehouse on link', async () => {
    await expect(service.link('store-1', 'wh-missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
