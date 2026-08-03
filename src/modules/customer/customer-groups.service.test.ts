import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomerGroupsService } from './customer-groups.service';

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MembershipRow = {
  id: string;
  customerId: string;
  groupId: string;
  createdAt: Date;
};

type CustomerRow = { id: string };

function uniqueViolation(): QueryFailedError {
  return new QueryFailedError('INSERT', [], { code: '23505' } as never);
}

describe('CustomerGroupsService (unit)', () => {
  const now = new Date('2026-08-03T12:00:00Z');
  let groups: GroupRow[];
  let memberships: MembershipRow[];
  let customers: CustomerRow[];
  let service: CustomerGroupsService;

  beforeEach(() => {
    groups = [];
    memberships = [];
    customers = [{ id: 'cust-1' }];
    let groupSeq = 0;

    const groupsRepo = {
      find: vi.fn(async () => [...groups].sort((a, b) => a.name.localeCompare(b.name))),
      findOne: vi.fn(async ({ where }: { where: Partial<GroupRow> }) => {
        if (where.id) return groups.find((g) => g.id === where.id) ?? null;
        return null;
      }),
      create: vi.fn((data: Partial<GroupRow>) => ({
        id: `group-${++groupSeq}`,
        description: null,
        createdAt: now,
        updatedAt: now,
        ...data,
      })),
      save: vi.fn(async (row: GroupRow) => {
        const idx = groups.findIndex((g) => g.id === row.id);
        if (idx >= 0) {
          if (groups.some((g) => g.name === row.name && g.id !== row.id)) {
            throw uniqueViolation();
          }
          groups[idx] = row;
          return row;
        }
        if (groups.some((g) => g.name === row.name)) {
          throw uniqueViolation();
        }
        groups.push(row);
        return row;
      }),
    };

    const membershipsRepo = {
      find: vi.fn(
        async ({ where }: { where: Partial<MembershipRow> }) =>
          memberships.filter((m) => {
            if (where.groupId && m.groupId !== where.groupId) return false;
            if (where.customerId && m.customerId !== where.customerId) {
              return false;
            }
            return true;
          }),
      ),
      findOne: vi.fn(
        async ({ where }: { where: Partial<MembershipRow> }) =>
          memberships.find(
            (m) =>
              m.customerId === where.customerId && m.groupId === where.groupId,
          ) ?? null,
      ),
      create: vi.fn((data: Partial<MembershipRow>) => ({
        id: 'mem-new',
        createdAt: now,
        ...data,
      })),
      save: vi.fn(async (row: MembershipRow) => {
        if (
          memberships.some(
            (m) =>
              m.customerId === row.customerId && m.groupId === row.groupId,
          )
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

    const customersRepo = {
      findOne: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          customers.find((c) => c.id === where.id) ?? null,
      ),
    };

    service = new CustomerGroupsService(
      groupsRepo as never,
      membershipsRepo as never,
      customersRepo as never,
    );
  });

  it('creates a group and adds a member', async () => {
    const group = await service.create({
      name: 'VIP',
      description: 'High value',
    });
    expect(group.name).toBe('VIP');

    const membership = await service.addMember({
      customerId: 'cust-1',
      groupId: group.id,
    });
    expect(membership.customerId).toBe('cust-1');
    expect(membership.groupId).toBe(group.id);
  });

  it('rejects duplicate group name', async () => {
    await service.create({ name: 'VIP' });
    await expect(service.create({ name: 'VIP' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects membership for missing customer', async () => {
    const group = await service.create({ name: 'VIP' });
    await expect(
      service.addMember({ customerId: 'missing', groupId: group.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes a membership', async () => {
    const group = await service.create({ name: 'VIP' });
    await service.addMember({ customerId: 'cust-1', groupId: group.id });
    const removed = await service.removeMember('cust-1', group.id);
    expect(removed.customerId).toBe('cust-1');
    await expect(
      service.removeMember('cust-1', group.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
