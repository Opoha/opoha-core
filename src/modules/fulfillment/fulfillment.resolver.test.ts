import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../auth/permissions/require-permission.decorator';
import { FulfillmentResolver } from './fulfillment.resolver';
import { FulfillmentService } from './fulfillment.service';

/**
 * fulfillment GraphQL permission metadata + resolver wiring.
 */
describe('FulfillmentResolver RBAC (resolver metadata + PermissionsGuard)', () => {
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByOrderId: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    pick: ReturnType<typeof vi.fn>;
    pack: ReturnType<typeof vi.fn>;
    ship: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  let resolver: FulfillmentResolver;

  function gqlContext(req: { user?: unknown }, handler: (...args: never[]) => unknown) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => FulfillmentResolver,
      getHandler: () => handler,
    };
  }

  beforeEach(() => {
    service = {
      findAll: vi.fn(async () => []),
      findById: vi.fn(async () => ({ id: 'f1' })),
      findByOrderId: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: 'f1' })),
      pick: vi.fn(async () => ({ id: 'f1', status: 'picked' })),
      pack: vi.fn(async () => ({ id: 'f1', status: 'packed' })),
      ship: vi.fn(async () => ({ id: 'f1', status: 'shipped' })),
      cancel: vi.fn(async () => ({ id: 'f1', status: 'cancelled' })),
    };
    resolver = new FulfillmentResolver(service as unknown as FulfillmentService);
  });

  it('declares fulfillment:* permission keys', () => {
    const reflector = new Reflector();
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, FulfillmentResolver.prototype.fulfillments),
    ).toEqual(['fulfillment:read']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, FulfillmentResolver.prototype.fulfillment),
    ).toEqual(['fulfillment:read']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, FulfillmentResolver.prototype.fulfillmentsByOrder),
    ).toEqual(['fulfillment:read']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, FulfillmentResolver.prototype.createFulfillment),
    ).toEqual(['fulfillment:create']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, FulfillmentResolver.prototype.pickFulfillment),
    ).toEqual(['fulfillment:pick']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, FulfillmentResolver.prototype.packFulfillment),
    ).toEqual(['fulfillment:pack']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, FulfillmentResolver.prototype.shipFulfillment),
    ).toEqual(['fulfillment:ship']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, FulfillmentResolver.prototype.cancelFulfillment),
    ).toEqual(['fulfillment:cancel']);
  });

  it('PermissionsGuard denies shipFulfillment without fulfillment:ship', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['fulfillment:ship'] : undefined,
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
              permissions: ['fulfillment:read'],
            },
          },
          FulfillmentResolver.prototype.shipFulfillment,
        ) as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('delegates shipFulfillment to service', async () => {
    await resolver.shipFulfillment('f1', {
      destination: { countryCode: 'US' },
    });
    expect(service.ship).toHaveBeenCalledWith('f1', {
      destination: { countryCode: 'US' },
    });
  });
});
