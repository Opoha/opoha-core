import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { VendorService } from './vendor.service';

type VendorRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  storeId: string | null;
  commissionBps: number;
  isActive: boolean;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProductRow = {
  id: string;
  vendorId: string | null;
  slug: string;
};

describe('VendorService (unit)', () => {
  const now = new Date('2026-08-04T03:00:00Z');
  let vendorStore: VendorRow[];
  let productStore: ProductRow[];
  let service: VendorService;
  let vendorsRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let productsRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  let eventBus: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vendorStore = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        code: 'SHOP-A',
        name: 'Shop A',
        description: null,
        storeId: null,
        commissionBps: 1000,
        isActive: true,
        email: null,
        createdAt: now,
        updatedAt: now,
      },
    ];
    productStore = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        vendorId: null,
        slug: 'widget',
      },
    ];

    vendorsRepo = {
      find: vi.fn(async () => [...vendorStore].sort((a, b) => a.code.localeCompare(b.code))),
      findOne: vi.fn(async ({ where }: { where: Partial<VendorRow> }) => {
        if (where.id) {
          return vendorStore.find((r) => r.id === where.id) ?? null;
        }
        if (where.code) {
          return vendorStore.find((r) => r.code === where.code) ?? null;
        }
        return null;
      }),
      create: vi.fn((data: Partial<VendorRow>) => ({
        id: '33333333-3333-4333-8333-333333333333',
        description: null,
        storeId: null,
        commissionBps: 0,
        isActive: true,
        email: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: VendorRow) => {
        const idx = vendorStore.findIndex((r) => r.id === row.id);
        if (idx >= 0) {
          vendorStore[idx] = { ...row, updatedAt: now };
          return vendorStore[idx];
        }
        vendorStore.push(row);
        return row;
      }),
      delete: vi.fn(async ({ id }: { id: string }) => {
        vendorStore = vendorStore.filter((r) => r.id !== id);
      }),
    };

    productsRepo = {
      find: vi.fn(async ({ where }: { where: Partial<ProductRow> }) =>
        productStore.filter((p) => (where.vendorId ? p.vendorId === where.vendorId : true)),
      ),
      findOne: vi.fn(
        async ({ where }: { where: Partial<ProductRow> }) =>
          productStore.find((p) => p.id === where.id) ?? null,
      ),
      save: vi.fn(async (row: ProductRow) => {
        const idx = productStore.findIndex((p) => p.id === row.id);
        if (idx >= 0) {
          productStore[idx] = row;
        }
        return row;
      }),
      count: vi.fn(
        async ({ where }: { where: Partial<ProductRow> }) =>
          productStore.filter((p) => p.vendorId === where.vendorId).length,
      ),
    };

    eventBus = { publish: vi.fn(async () => undefined) };

    service = new VendorService(vendorsRepo as never, productsRepo as never, eventBus as never);
  });

  it('creates a vendor and publishes VendorUpdated', async () => {
    const created = await service.create({
      code: ' SHOP-B ',
      name: ' Shop B ',
      commissionBps: 500,
    });
    expect(created.code).toBe('SHOP-B');
    expect(created.name).toBe('Shop B');
    expect(created.commissionBps).toBe(500);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.VendorUpdated,
        data: expect.objectContaining({ action: 'created', code: 'SHOP-B' }),
      }),
    );
  });

  it('rejects empty code and invalid commission', async () => {
    await expect(service.create({ code: '  ', name: 'X' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.create({ code: 'Z', name: 'X', commissionBps: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assigns and clears product vendor', async () => {
    const assigned = await service.assignProductVendor({
      productId: '22222222-2222-4222-8222-222222222222',
      vendorId: '11111111-1111-4111-8111-111111111111',
    });
    expect(assigned.vendorId).toBe('11111111-1111-4111-8111-111111111111');
    expect(productStore[0]!.vendorId).toBe('11111111-1111-4111-8111-111111111111');

    const cleared = await service.assignProductVendor({
      productId: '22222222-2222-4222-8222-222222222222',
      vendorId: null,
    });
    expect(cleared.vendorId).toBeNull();
  });

  it('blocks delete when products still reference vendor', async () => {
    productStore[0]!.vendorId = '11111111-1111-4111-8111-111111111111';
    await expect(service.remove('11111111-1111-4111-8111-111111111111')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws NotFound for missing vendor', async () => {
    await expect(service.findById('99999999-9999-4999-8999-999999999999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws Conflict on duplicate code', async () => {
    const { QueryFailedError } = await import('typeorm');
    vendorsRepo.save.mockRejectedValueOnce(
      Object.assign(new QueryFailedError('', [], new Error('dup')), {
        driverError: { code: '23505' },
      }),
    );
    await expect(service.create({ code: 'SHOP-A', name: 'Dup' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
