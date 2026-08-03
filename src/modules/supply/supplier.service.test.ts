import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { SupplierService } from './supplier.service';

type SupplierRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  countryCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

describe('SupplierService (unit)', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  let store: SupplierRow[];
  let service: SupplierService;
  let suppliersRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let eventBus: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    store = [
      {
        id: 'sup-1',
        code: 'ACME',
        name: 'Acme Supplies',
        description: null,
        isActive: true,
        email: null,
        phone: null,
        contactName: null,
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

    suppliersRepo = {
      find: vi.fn(async () => [...store].sort((a, b) => a.code.localeCompare(b.code))),
      findOne: vi.fn(async ({ where }: { where: Partial<SupplierRow> }) => {
        if (where.id) {
          return store.find((r) => r.id === where.id) ?? null;
        }
        if (where.code) {
          return store.find((r) => r.code === where.code) ?? null;
        }
        return null;
      }),
      create: vi.fn((data: Partial<SupplierRow>) => ({
        id: 'sup-new',
        description: null,
        isActive: true,
        email: null,
        phone: null,
        contactName: null,
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
      save: vi.fn(async (row: SupplierRow) => {
        const idx = store.findIndex((r) => r.id === row.id);
        if (idx >= 0) {
          store[idx] = { ...row };
          return store[idx];
        }
        store.push({ ...row });
        return row;
      }),
      delete: vi.fn(async ({ id }: { id: string }) => {
        store = store.filter((r) => r.id !== id);
      }),
    };

    eventBus = { publish: vi.fn(async () => undefined) };

    service = new SupplierService(suppliersRepo as never, eventBus as never);
  });

  it('lists suppliers ordered by code', async () => {
    const rows = await service.findAll();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.code).toBe('ACME');
  });

  it('creates a supplier and publishes SupplierUpdated', async () => {
    const created = await service.create({
      code: ' VEN-01 ',
      name: ' Vendor One ',
      countryCode: 'th',
    });
    expect(created.code).toBe('VEN-01');
    expect(created.name).toBe('Vendor One');
    expect(created.countryCode).toBe('TH');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.SupplierUpdated,
        data: expect.objectContaining({ action: 'created', code: 'VEN-01' }),
      }),
    );
  });

  it('rejects empty code', async () => {
    await expect(
      service.create({ code: '   ', name: 'X' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty name', async () => {
    await expect(
      service.create({ code: 'X-1', name: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps unique code violations to ConflictException', async () => {
    const { QueryFailedError } = await import('typeorm');
    const qfe = new QueryFailedError('INSERT', [], {
      code: '23505',
    } as never);
    suppliersRepo.save.mockRejectedValueOnce(qfe);

    await expect(
      service.create({ code: 'ACME', name: 'Dup' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('finds supplier by code', async () => {
    const row = await service.findByCode('ACME');
    expect(row.id).toBe('sup-1');
  });

  it('throws NotFound for missing code', async () => {
    await expect(service.findByCode('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a supplier and publishes SupplierUpdated', async () => {
    const updated = await service.update('sup-1', {
      name: 'Acme Renamed',
      isActive: false,
    });
    expect(updated.name).toBe('Acme Renamed');
    expect(updated.isActive).toBe(false);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.SupplierUpdated,
        data: expect.objectContaining({ action: 'updated', supplierId: 'sup-1' }),
      }),
    );
  });

  it('throws NotFound updating missing supplier', async () => {
    await expect(
      service.update('missing', { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes a supplier and publishes SupplierUpdated', async () => {
    const removed = await service.remove('sup-1');
    expect(removed.id).toBe('sup-1');
    expect(store).toHaveLength(0);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.SupplierUpdated,
        data: expect.objectContaining({ action: 'deleted', supplierId: 'sup-1' }),
      }),
    );
  });

  it('throws NotFound removing missing supplier', async () => {
    await expect(service.remove('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
