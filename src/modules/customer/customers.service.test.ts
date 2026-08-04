import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
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

vi.mock('../auth/public', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/public')>();
  return {
    ...actual,
    hashPassword: (password: string) => `hashed:${password}`,
  };
});

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError('INSERT', [], { code: '23505' } as never);
}

describe('CustomersService (unit)', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  let store: CustomerRow[];
  let service: CustomersService;
  let customersRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let eventBus: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    store = [];
    customersRepo = {
      find: vi.fn(async () => [...store]),
      findOne: vi.fn(async ({ where }: { where: Partial<CustomerRow> }) => {
        if (where.id) {
          return store.find((r) => r.id === where.id) ?? null;
        }
        if (where.email) {
          return store.find((r) => r.email === where.email) ?? null;
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
        const existingIdx = store.findIndex((r) => r.id === row.id);
        if (existingIdx >= 0) {
          store[existingIdx] = row;
          return row;
        }
        if (store.some((r) => r.email === row.email)) {
          throw uniqueViolation();
        }
        store.push(row);
        return row;
      }),
    };
    eventBus = { publish: vi.fn(async () => undefined) };
    service = new CustomersService(customersRepo as never, eventBus as never);
  });

  it('registers a customer and publishes CustomerCreated', async () => {
    const result = await service.register({
      email: 'Buyer@Example.com',
      password: 'password1',
      firstName: 'Ada',
    });

    expect(result.email).toBe('buyer@example.com');
    expect(result.firstName).toBe('Ada');
    expect(result.id).toBe('cust-new');
    expect(store[0]?.passwordHash).toBe('hashed:password1');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.CustomerCreated,
        aggregateType: 'customer',
        aggregateId: 'cust-new',
        data: { customerId: 'cust-new', email: 'buyer@example.com' },
      }),
    );
  });

  it('rejects short passwords', async () => {
    await expect(service.register({ email: 'a@b.co', password: 'short' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects invalid email', async () => {
    await expect(
      service.register({ email: 'not-an-email', password: 'password1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate email on register', async () => {
    store.push({
      id: 'cust-1',
      email: 'buyer@example.com',
      passwordHash: 'x',
      firstName: null,
      lastName: null,
      phone: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.register({
        email: 'buyer@example.com',
        password: 'password1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates profile fields', async () => {
    store.push({
      id: 'cust-1',
      email: 'buyer@example.com',
      passwordHash: 'x',
      firstName: 'Ada',
      lastName: null,
      phone: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const updated = await service.update({
      id: 'cust-1',
      lastName: 'Lovelace',
      phone: '+1',
    });
    expect(updated.lastName).toBe('Lovelace');
    expect(updated.phone).toBe('+1');
  });

  it('throws when updating missing customer', async () => {
    await expect(service.update({ id: 'missing', firstName: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
