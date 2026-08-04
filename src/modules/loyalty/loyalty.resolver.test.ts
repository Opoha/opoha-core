import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../auth/permissions/require-permission.decorator';
import { LoyaltyResolver } from './loyalty.resolver';
import { LoyaltyService } from './loyalty.service';

/**
 * C-04 — loyalty GraphQL permission metadata + resolver wiring.
 */
describe('LoyaltyResolver RBAC (resolver metadata + PermissionsGuard)', () => {
  let service: {
    findByCustomerId: ReturnType<typeof vi.fn>;
    listTransactions: ReturnType<typeof vi.fn>;
    quoteRedeem: ReturnType<typeof vi.fn>;
    accrue: ReturnType<typeof vi.fn>;
    redeem: ReturnType<typeof vi.fn>;
  };
  let resolver: LoyaltyResolver;

  function gqlContext(req: { user?: unknown }, handler: (...args: never[]) => unknown) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => LoyaltyResolver,
      getHandler: () => handler,
    };
  }

  beforeEach(() => {
    service = {
      findByCustomerId: vi.fn(async () => ({
        id: 'la1',
        customerId: 'c1',
        pointsBalance: 100,
      })),
      listTransactions: vi.fn(async () => []),
      quoteRedeem: vi.fn(async () => ({
        customerId: 'c1',
        availablePoints: 100,
        pointsToRedeem: 50,
        appliedMinor: '50',
      })),
      accrue: vi.fn(async () => ({ id: 'la1', pointsBalance: 150 })),
      redeem: vi.fn(async () => ({ id: 'la1', pointsBalance: 50 })),
    };
    resolver = new LoyaltyResolver(service as unknown as LoyaltyService);
  });

  it('declares loyalty:* permission keys', () => {
    const reflector = new Reflector();
    expect(reflector.get(REQUIRE_PERMISSION_KEY, LoyaltyResolver.prototype.loyaltyAccount)).toEqual(
      ['loyalty:read'],
    );
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, LoyaltyResolver.prototype.loyaltyTransactions),
    ).toEqual(['loyalty:read']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, LoyaltyResolver.prototype.quoteLoyaltyRedeem),
    ).toEqual(['loyalty:read']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, LoyaltyResolver.prototype.accrueLoyaltyPoints),
    ).toEqual(['loyalty:accrue']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, LoyaltyResolver.prototype.redeemLoyaltyPoints),
    ).toEqual(['loyalty:redeem']);
  });

  it('PermissionsGuard denies redeemLoyaltyPoints without loyalty:redeem', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['loyalty:redeem'] : undefined,
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
              permissions: ['loyalty:read'],
            },
          },
          LoyaltyResolver.prototype.redeemLoyaltyPoints,
        ) as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('delegates accrueLoyaltyPoints / redeemLoyaltyPoints to service', async () => {
    await resolver.accrueLoyaltyPoints({
      customerId: 'c1',
      points: 50,
      orderId: 'o1',
    });
    expect(service.accrue).toHaveBeenCalledWith({
      customerId: 'c1',
      points: 50,
      orderId: 'o1',
    });

    await resolver.redeemLoyaltyPoints({
      customerId: 'c1',
      points: 25,
    });
    expect(service.redeem).toHaveBeenCalledWith({
      customerId: 'c1',
      points: 25,
    });
  });
});
