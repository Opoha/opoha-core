import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../auth/permissions/require-permission.decorator';
import { CartResolver } from './cart.resolver';
import { CheckoutResolver } from './checkout.resolver';
import { OrdersResolver } from './orders.resolver';

/**
 * D-01 / D-02 — cart/checkout GraphQL permission metadata + RBAC deny path.
 */
describe('cart/order RBAC (resolver metadata + PermissionsGuard deny)', () => {
  function gqlContext(
    req: { user?: unknown },
    handler: (...args: never[]) => unknown,
    resolverClass: new (...args: never[]) => unknown,
  ) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => resolverClass,
      getHandler: () => handler,
    };
  }

  it('CartResolver declares cart:* permission keys', () => {
    const reflector = new Reflector();
    expect(reflector.get(REQUIRE_PERMISSION_KEY, CartResolver.prototype.carts)).toEqual([
      'cart:read',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, CartResolver.prototype.createCart)).toEqual([
      'cart:create',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, CartResolver.prototype.addCartLine)).toEqual([
      'cart:update',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, CartResolver.prototype.updateCartLine)).toEqual([
      'cart:update',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, CartResolver.prototype.removeCartLine)).toEqual([
      'cart:update',
    ]);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, CartResolver.prototype.selectCartShipping),
    ).toEqual(['cart:update']);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, CartResolver.prototype.setCartTaxContext)).toEqual(
      ['cart:update'],
    );
  });

  it('CheckoutResolver declares cart:checkout', () => {
    const reflector = new Reflector();
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, CheckoutResolver.prototype.prepareCheckout),
    ).toEqual(['cart:checkout']);
  });

  it('OrdersResolver declares order:read/create/update', () => {
    const reflector = new Reflector();
    expect(reflector.get(REQUIRE_PERMISSION_KEY, OrdersResolver.prototype.orders)).toEqual([
      'order:read',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, OrdersResolver.prototype.order)).toEqual([
      'order:read',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, OrdersResolver.prototype.placeOrder)).toEqual([
      'order:create',
    ]);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, OrdersResolver.prototype.updateOrderStatus),
    ).toEqual(['order:update']);
  });

  it('PermissionsGuard denies addCartLine without cart:update', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['cart:update'] : undefined,
        ),
      } as unknown as Reflector,
      { listKeysForUser: vi.fn() } as never,
    );
    await expect(
      guard.canActivate(
        gqlContext(
          {
            user: {
              userId: 'u1',
              email: 'clerk@example.com',
              permissions: ['cart:read'],
            },
          },
          CartResolver.prototype.addCartLine,
          CartResolver,
        ) as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PermissionsGuard allows prepareCheckout when cart:checkout granted', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn().mockReturnValue(['cart:checkout']),
      } as unknown as Reflector,
      { listKeysForUser: vi.fn() } as never,
    );
    await expect(
      guard.canActivate(
        gqlContext(
          {
            user: {
              userId: 'u1',
              email: 'admin@example.com',
              permissions: ['cart:checkout', 'cart:read'],
            },
          },
          CheckoutResolver.prototype.prepareCheckout,
          CheckoutResolver,
        ) as never,
      ),
    ).resolves.toBe(true);
  });
});
