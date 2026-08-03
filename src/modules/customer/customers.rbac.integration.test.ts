import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../auth/permissions/require-permission.decorator';
import { CustomersResolver } from './customers.resolver';
import { CustomerGroupsResolver } from './customer-groups.resolver';

/**
 * C-02 — customer GraphQL permission metadata + RBAC deny path.
 */
describe('customer RBAC (resolver metadata + PermissionsGuard deny)', () => {
  function gqlContext(req: { user?: unknown }) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => CustomersResolver,
      getHandler: () => CustomersResolver.prototype.createCustomer,
    };
  }

  it('CustomersResolver declares customer:* permission keys', () => {
    const reflector = new Reflector();
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        CustomersResolver.prototype.customers,
      ),
    ).toEqual(['customer:read']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        CustomersResolver.prototype.createCustomer,
      ),
    ).toEqual(['customer:create']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        CustomersResolver.prototype.updateCustomer,
      ),
    ).toEqual(['customer:update']);
  });

  it('CustomerGroupsResolver declares customer-group:* permission keys', () => {
    const reflector = new Reflector();
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        CustomerGroupsResolver.prototype.customerGroups,
      ),
    ).toEqual(['customer-group:read']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        CustomerGroupsResolver.prototype.createCustomerGroup,
      ),
    ).toEqual(['customer-group:create']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        CustomerGroupsResolver.prototype.addCustomerToGroup,
      ),
    ).toEqual(['customer-group:update']);
  });

  it('PermissionsGuard denies createCustomer without customer:create', async () => {
    const req = {
      headers: {},
      user: {
        userId: 'u1',
        email: 'clerk@example.com',
        apiKeyId: 'ak-1',
        permissions: ['customer:read'],
      },
    };
    const permissionsGuard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['customer:create'] : undefined,
        ),
      } as unknown as Reflector,
      { listKeysForUser: vi.fn() } as never,
    );

    await expect(
      permissionsGuard.canActivate(gqlContext(req) as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PermissionsGuard allows createCustomer when customer:create is granted', async () => {
    const req = {
      headers: {},
      user: {
        userId: 'u1',
        email: 'admin@example.com',
        apiKeyId: 'ak-1',
        permissions: ['customer:create', 'customer:read'],
      },
    };
    const permissionsGuard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn().mockReturnValue(['customer:create']),
      } as unknown as Reflector,
      { listKeysForUser: vi.fn() } as never,
    );

    await expect(
      permissionsGuard.canActivate(gqlContext(req) as never),
    ).resolves.toBe(true);
  });
});
