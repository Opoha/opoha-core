import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { CustomerAddressesService } from './customer-addresses.service';
import { CustomersService } from './customers.service';

type CustomerRow = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AddressRow = {
  id: string;
  customerId: string;
  label: string | null;
  firstName: string;
  lastName: string;
  company: string | null;
  line1: string;
  line2: string | null;
  city: string;
  province: string | null;
  postalCode: string;
  countryCode: string;
  phone: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

vi.mock('../auth/public', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/public')>();
  return {
    ...actual,
    hashPassword: (password: string) => `hashed:${password}`,
  };
});

describe('CustomerAddressesService (unit)', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  let customerStore: CustomerRow[];
  let addressStore: AddressRow[];
  let addressSeq: number;
  let service: CustomerAddressesService;
  let customersService: CustomersService;
  let addressesRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let customersRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let eventBus: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    customerStore = [];
    addressStore = [];
    addressSeq = 0;

    customersRepo = {
      find: vi.fn(async () => [...customerStore]),
      findOne: vi.fn(async ({ where }: { where: Partial<CustomerRow> }) => {
        if (where.id) {
          return customerStore.find((r) => r.id === where.id) ?? null;
        }
        if (where.email) {
          return customerStore.find((r) => r.email === where.email) ?? null;
        }
        return null;
      }),
      create: vi.fn((data: Partial<CustomerRow>) => ({
        id: 'cust-new',
        firstName: null,
        lastName: null,
        phone: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: CustomerRow) => {
        const existingIdx = customerStore.findIndex((r) => r.id === row.id);
        if (existingIdx >= 0) {
          customerStore[existingIdx] = row;
          return row;
        }
        customerStore.push(row);
        return row;
      }),
    };

    addressesRepo = {
      find: vi.fn(
        async ({
          where,
        }: {
          where: Partial<AddressRow>;
          order?: unknown;
        }) => {
          return addressStore.filter((r) => {
            if (where.customerId && r.customerId !== where.customerId) {
              return false;
            }
            if (where.isDefault !== undefined && r.isDefault !== where.isDefault) {
              return false;
            }
            return true;
          });
        },
      ),
      findOne: vi.fn(async ({ where }: { where: Partial<AddressRow> }) => {
        if (where.id) {
          return addressStore.find((r) => r.id === where.id) ?? null;
        }
        return null;
      }),
      count: vi.fn(async ({ where }: { where: Partial<AddressRow> }) => {
        return addressStore.filter((r) => r.customerId === where.customerId)
          .length;
      }),
      create: vi.fn((data: Partial<AddressRow>) => ({
        id: `addr-${++addressSeq}`,
        label: null,
        company: null,
        line2: null,
        province: null,
        phone: null,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: AddressRow) => {
        const idx = addressStore.findIndex((r) => r.id === row.id);
        if (idx >= 0) {
          addressStore[idx] = row;
          return row;
        }
        addressStore.push(row);
        return row;
      }),
      delete: vi.fn(async ({ id }: { id: string }) => {
        addressStore = addressStore.filter((r) => r.id !== id);
        return { affected: 1 };
      }),
    };

    eventBus = { publish: vi.fn(async () => undefined) };
    customersService = new CustomersService(
      customersRepo as never,
      eventBus as never,
    );
    service = new CustomerAddressesService(
      addressesRepo as never,
      customersRepo as never,
    );
  });

  it('register + address flow: create, list, update, delete', async () => {
    const customer = await customersService.register({
      email: 'buyer@example.com',
      password: 'password1',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.CustomerCreated,
        aggregateId: customer.id,
      }),
    );

    const created = await service.create({
      customerId: customer.id,
      firstName: 'Ada',
      lastName: 'Lovelace',
      line1: '1 Analytical Engine Way',
      city: 'London',
      postalCode: 'SW1A 1AA',
      countryCode: 'gb',
    });

    expect(created.countryCode).toBe('GB');
    expect(created.isDefault).toBe(true);
    expect(created.customerId).toBe(customer.id);

    const listed = await service.listByCustomer(customer.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);

    const updated = await service.update({
      id: created.id,
      city: 'Cambridge',
      label: 'Home',
    });
    expect(updated.city).toBe('Cambridge');
    expect(updated.label).toBe('Home');

    const removed = await service.remove(created.id);
    expect(removed.id).toBe(created.id);
    await expect(service.findById(created.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('promotes first address to default and clears prior default when setting another', async () => {
    customerStore.push({
      id: 'cust-1',
      email: 'a@b.co',
      passwordHash: 'x',
      firstName: null,
      lastName: null,
      phone: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const first = await service.create({
      customerId: 'cust-1',
      firstName: 'A',
      lastName: 'B',
      line1: '1 Main',
      city: 'Town',
      postalCode: '10000',
      countryCode: 'US',
    });
    expect(first.isDefault).toBe(true);

    const second = await service.create({
      customerId: 'cust-1',
      firstName: 'A',
      lastName: 'B',
      line1: '2 Side',
      city: 'Town',
      postalCode: '10001',
      countryCode: 'US',
      isDefault: true,
    });
    expect(second.isDefault).toBe(true);

    const firstAfter = await service.findById(first.id);
    expect(firstAfter.isDefault).toBe(false);
  });

  it('rejects invalid country code', async () => {
    customerStore.push({
      id: 'cust-1',
      email: 'a@b.co',
      passwordHash: 'x',
      firstName: null,
      lastName: null,
      phone: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.create({
        customerId: 'cust-1',
        firstName: 'A',
        lastName: 'B',
        line1: '1 Main',
        city: 'Town',
        postalCode: '10000',
        countryCode: 'USA',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when customer is missing', async () => {
    await expect(
      service.create({
        customerId: 'missing',
        firstName: 'A',
        lastName: 'B',
        line1: '1 Main',
        city: 'Town',
        postalCode: '10000',
        countryCode: 'US',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
