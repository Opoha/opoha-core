import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../../auth/permissions/require-permission.decorator';
import { ProductsResolver } from './products.resolver';

/**
 * A-08 — product CRUD service coverage lives in products.service.test.ts;
 * this file asserts ProductsResolver permission metadata + RBAC deny path.
 */
describe('catalog product RBAC (resolver metadata + PermissionsGuard deny)', () => {
  function gqlContext(req: { user?: unknown }) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => ProductsResolver,
      getHandler: () => ProductsResolver.prototype.createProduct,
      switchToHttp: () => ({ getRequest: () => req }),
    };
  }

  it('ProductsResolver mutations declare product:* permission keys', () => {
    const reflector = new Reflector();
    expect(reflector.get(REQUIRE_PERMISSION_KEY, ProductsResolver.prototype.createProduct)).toEqual(
      ['product:create'],
    );
    expect(reflector.get(REQUIRE_PERMISSION_KEY, ProductsResolver.prototype.products)).toEqual([
      'product:read',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, ProductsResolver.prototype.updateProduct)).toEqual(
      ['product:update'],
    );
    expect(reflector.get(REQUIRE_PERMISSION_KEY, ProductsResolver.prototype.deleteProduct)).toEqual(
      ['product:delete'],
    );
  });

  it('PermissionsGuard denies createProduct when caller lacks product:create', async () => {
    const req = {
      headers: {},
      user: {
        userId: 'u1',
        email: 'clerk@example.com',
        apiKeyId: 'ak-1',
        permissions: ['product:read'],
      },
    };
    const permissionsGuard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['product:create'] : undefined,
        ),
      } as unknown as Reflector,
      { listKeysForUser: vi.fn() } as never,
    );

    await expect(permissionsGuard.canActivate(gqlContext(req) as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('PermissionsGuard allows createProduct when product:create is granted', async () => {
    const req = {
      headers: {},
      user: {
        userId: 'u1',
        email: 'admin@example.com',
        apiKeyId: 'ak-1',
        permissions: ['product:create', 'product:read'],
      },
    };
    const permissionsGuard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn().mockReturnValue(['product:create']),
      } as unknown as Reflector,
      { listKeysForUser: vi.fn() } as never,
    );

    await expect(permissionsGuard.canActivate(gqlContext(req) as never)).resolves.toBe(true);
  });
});
