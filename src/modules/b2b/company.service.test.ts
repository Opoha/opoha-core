import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CoreEventName } from '../event-bus/event-catalog';
import { CompanyService } from './company.service';
import type { CompanyBuyerRole } from './entities';

type CompanyRow = {
  id: string;
  storeId: string;
  name: string;
  creditLimitMinor: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type MembershipRow = {
  id: string;
  companyId: string;
  customerId: string;
  role: CompanyBuyerRole;
  createdAt: Date;
  updatedAt: Date;
};

type PriceListRow = {
  id: string;
  companyId: string;
  variantId: string;
  priceMinor: string;
  createdAt: Date;
  updatedAt: Date;
};

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError('INSERT', [], { code: '23505' } as never);
}

describe('CompanyService', () => {
  const now = new Date('2026-08-03T20:00:00Z');
  const storeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const customerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const variantId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

  let companies: CompanyRow[];
  let memberships: MembershipRow[];
  let priceListRows: PriceListRow[];
  let service: CompanyService;
  let companiesRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let membershipsRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let priceListRepo: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let stores: { findById: ReturnType<typeof vi.fn> };
  let customers: { findById: ReturnType<typeof vi.fn> };
  let eventBus: { publish: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    companies = [];
    memberships = [];
    priceListRows = [];
    companiesRepo = {
      find: vi.fn(async ({ where }: { where?: Partial<CompanyRow> } = {}) => {
        if (where?.storeId) {
          return companies.filter((c) => c.storeId === where.storeId);
        }
        return [...companies];
      }),
      findOne: vi.fn(async ({ where }: { where: Partial<CompanyRow> }) => {
        return companies.find((c) => c.id === where.id) ?? null;
      }),
      create: vi.fn((data: Partial<CompanyRow>) => ({
        id: 'company-new',
        creditLimitMinor: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: CompanyRow) => {
        const idx = companies.findIndex((c) => c.id === row.id);
        if (idx >= 0) {
          companies[idx] = row;
          return row;
        }
        companies.push(row);
        return row;
      }),
    };
    membershipsRepo = {
      find: vi.fn(async ({ where }: { where: Partial<MembershipRow> }) => {
        return memberships.filter((m) => m.companyId === where.companyId);
      }),
      findOne: vi.fn(async ({ where }: { where: Partial<MembershipRow> }) => {
        return (
          memberships.find(
            (m) => m.companyId === where.companyId && m.customerId === where.customerId,
          ) ?? null
        );
      }),
      create: vi.fn((data: Partial<MembershipRow>) => ({
        id: 'mem-new',
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: MembershipRow) => {
        const idx = memberships.findIndex((m) => m.id === row.id);
        if (idx >= 0) {
          memberships[idx] = row;
          return row;
        }
        if (
          memberships.some((m) => m.companyId === row.companyId && m.customerId === row.customerId)
        ) {
          throw uniqueViolation();
        }
        memberships.push(row);
        return row;
      }),
      remove: vi.fn(async (row: MembershipRow) => {
        memberships = memberships.filter((m) => m.id !== row.id);
        return row;
      }),
    };
    priceListRepo = {
      find: vi.fn(async ({ where }: { where: Partial<PriceListRow> }) => {
        return priceListRows.filter((r) => r.companyId === where.companyId);
      }),
      findOne: vi.fn(async ({ where }: { where: Partial<PriceListRow> }) => {
        return (
          priceListRows.find(
            (r) => r.companyId === where.companyId && r.variantId === where.variantId,
          ) ?? null
        );
      }),
      create: vi.fn((data: Partial<PriceListRow>) => ({
        id: 'price-new',
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: PriceListRow) => {
        const idx = priceListRows.findIndex((r) => r.id === row.id);
        if (idx >= 0) {
          priceListRows[idx] = row;
          return row;
        }
        priceListRows.push(row);
        return row;
      }),
      remove: vi.fn(async (row: PriceListRow) => {
        priceListRows = priceListRows.filter((r) => r.id !== row.id);
        return row;
      }),
    };
    stores = {
      findById: vi.fn(async (id: string) => ({ id, code: 'default' })),
    };
    customers = {
      findById: vi.fn(async (id: string) => ({ id, email: 'buyer@example.com' })),
    };
    eventBus = { publish: vi.fn(async () => undefined) };
    service = new CompanyService(
      companiesRepo as never,
      membershipsRepo as never,
      priceListRepo as never,
      stores as never,
      customers as never,
      eventBus as never,
    );
  });

  it('creates a company and publishes CompanyCreated', async () => {
    const result = await service.create({
      storeId,
      name: ' Acme Corp ',
      creditLimitMinor: '500000',
    });

    expect(result.name).toBe('Acme Corp');
    expect(result.storeId).toBe(storeId);
    expect(result.creditLimitMinor).toBe('500000');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.CompanyCreated,
        aggregateType: 'company',
        aggregateId: 'company-new',
        data: {
          companyId: 'company-new',
          storeId,
          name: 'Acme Corp',
        },
      }),
    );
  });

  it('rejects empty company name', async () => {
    await expect(service.create({ storeId, name: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('adds buyer membership and publishes CompanyMembershipUpdated', async () => {
    companies.push({
      id: 'company-1',
      storeId,
      name: 'Acme',
      creditLimitMinor: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const member = await service.addMember({
      companyId: 'company-1',
      customerId,
      role: 'Buyer',
    });

    expect(member.role).toBe('buyer');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: CoreEventName.CompanyMembershipUpdated,
        data: {
          companyId: 'company-1',
          customerId,
          role: 'buyer',
        },
      }),
    );
  });

  it('rejects duplicate membership', async () => {
    companies.push({
      id: 'company-1',
      storeId,
      name: 'Acme',
      creditLimitMinor: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    memberships.push({
      id: 'mem-1',
      companyId: 'company-1',
      customerId,
      role: 'buyer',
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      service.addMember({
        companyId: 'company-1',
        customerId,
        role: 'approver',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('assertCanBuy allows buyer/admin and denies approver-only', async () => {
    companies.push({
      id: 'company-1',
      storeId,
      name: 'Acme',
      creditLimitMinor: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    memberships.push({
      id: 'mem-1',
      companyId: 'company-1',
      customerId,
      role: 'approver',
      createdAt: now,
      updatedAt: now,
    });

    await expect(service.assertCanBuy('company-1', customerId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    memberships[0]!.role = 'buyer';
    await expect(service.assertCanBuy('company-1', customerId)).resolves.toBeUndefined();
  });

  it('assertCanApprove allows approver/admin and denies buyer-only', async () => {
    companies.push({
      id: 'company-1',
      storeId,
      name: 'Acme',
      creditLimitMinor: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    memberships.push({
      id: 'mem-1',
      companyId: 'company-1',
      customerId,
      role: 'buyer',
      createdAt: now,
      updatedAt: now,
    });

    await expect(service.assertCanApprove('company-1', customerId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    memberships[0]!.role = 'admin';
    await expect(service.assertCanApprove('company-1', customerId)).resolves.toBeUndefined();
  });

  it('throws when company missing', async () => {
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('setPriceListItem + resolveUnitPriceMinor apply negotiated price', async () => {
    companies.push({
      id: 'company-1',
      storeId,
      name: 'Acme',
      creditLimitMinor: '10000',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const item = await service.setPriceListItem({
      companyId: 'company-1',
      variantId,
      priceMinor: '750',
    });
    expect(item.priceMinor).toBe('750');

    await expect(service.resolveUnitPriceMinor('company-1', variantId, '1999')).resolves.toBe(
      '750',
    );
    await expect(service.resolveUnitPriceMinor(null, variantId, '1999')).resolves.toBe('1999');
    await expect(service.resolveUnitPriceMinor('company-1', 'other-variant', '1999')).resolves.toBe(
      '1999',
    );
  });

  it('assertWithinCreditLimit rejects totals above limit', async () => {
    companies.push({
      id: 'company-1',
      storeId,
      name: 'Acme',
      creditLimitMinor: '1000',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await expect(service.assertWithinCreditLimit('company-1', '1000')).resolves.toBeUndefined();
    await expect(service.assertWithinCreditLimit('company-1', '1001')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('assertWithinCreditLimit no-ops when limit unset', async () => {
    companies.push({
      id: 'company-1',
      storeId,
      name: 'Acme',
      creditLimitMinor: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await expect(service.assertWithinCreditLimit('company-1', '999999')).resolves.toBeUndefined();
  });
});
