import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../auth/permissions/require-permission.decorator';
import { InventoryResolver } from './inventory.resolver';

/**
 * B-03 — inventory GraphQL permission metadata + RBAC deny path.
 */
describe('inventory RBAC (resolver metadata + PermissionsGuard deny)', () => {
  function gqlContext(req: { user?: unknown }) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => InventoryResolver,
      getHandler: () => InventoryResolver.prototype.adjustInventory,
    };
  }

  it('InventoryResolver declares inventory:* permission keys', () => {
    const reflector = new Reflector();
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        InventoryResolver.prototype.inventoryItems,
      ),
    ).toEqual(['inventory:read']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        InventoryResolver.prototype.createInventoryItem,
      ),
    ).toEqual(['inventory:create']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        InventoryResolver.prototype.adjustInventory,
      ),
    ).toEqual(['inventory:adjust']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        InventoryResolver.prototype.reserveInventory,
      ),
    ).toEqual(['inventory:reserve']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        InventoryResolver.prototype.releaseInventoryReservation,
      ),
    ).toEqual(['inventory:release']);
  });

  it('PermissionsGuard denies adjustInventory without inventory:adjust', async () => {
    const req = {
      headers: {},
      user: {
        userId: 'u1',
        email: 'clerk@example.com',
        apiKeyId: 'ak-1',
        permissions: ['inventory:read'],
      },
    };
    const permissionsGuard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['inventory:adjust'] : undefined,
        ),
      } as unknown as Reflector,
      { listKeysForUser: vi.fn() } as never,
    );

    await expect(
      permissionsGuard.canActivate(gqlContext(req) as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PermissionsGuard allows adjustInventory when inventory:adjust is granted', async () => {
    const req = {
      headers: {},
      user: {
        userId: 'u1',
        email: 'admin@example.com',
        apiKeyId: 'ak-1',
        permissions: ['inventory:adjust', 'inventory:read'],
      },
    };
    const permissionsGuard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn().mockReturnValue(['inventory:adjust']),
      } as unknown as Reflector,
      { listKeysForUser: vi.fn() } as never,
    );

    await expect(
      permissionsGuard.canActivate(gqlContext(req) as never),
    ).resolves.toBe(true);
  });
});
