import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../auth/permissions/require-permission.decorator';
import { GiftCardsResolver } from './gift-cards.resolver';
import { GiftCardService } from './gift-cards.service';

/**
 * C-04 — gift card GraphQL permission metadata + resolver wiring.
 */
describe('GiftCardsResolver RBAC (resolver metadata + PermissionsGuard)', () => {
  let service: {
    findById: ReturnType<typeof vi.fn>;
    findByCode: ReturnType<typeof vi.fn>;
    listTransactions: ReturnType<typeof vi.fn>;
    quoteRedeem: ReturnType<typeof vi.fn>;
    issue: ReturnType<typeof vi.fn>;
    purchase: ReturnType<typeof vi.fn>;
    redeem: ReturnType<typeof vi.fn>;
  };
  let resolver: GiftCardsResolver;

  function gqlContext(req: { user?: unknown }, handler: (...args: never[]) => unknown) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => GiftCardsResolver,
      getHandler: () => handler,
    };
  }

  beforeEach(() => {
    service = {
      findById: vi.fn(async () => ({ id: 'gc1' })),
      findByCode: vi.fn(async () => ({ id: 'gc1', code: 'ABCD' })),
      listTransactions: vi.fn(async () => []),
      quoteRedeem: vi.fn(async () => ({
        giftCardId: 'gc1',
        code: 'ABCD',
        currencyCode: 'USD',
        availableMinor: '1000',
        appliedMinor: '500',
      })),
      issue: vi.fn(async () => ({ id: 'gc1', status: 'active' })),
      purchase: vi.fn(async () => ({ id: 'gc1', purchaseOrderId: 'o1' })),
      redeem: vi.fn(async () => ({ id: 'gc1', balanceMinor: '0' })),
    };
    resolver = new GiftCardsResolver(service as unknown as GiftCardService);
  });

  it('declares giftcard:* permission keys', () => {
    const reflector = new Reflector();
    expect(reflector.get(REQUIRE_PERMISSION_KEY, GiftCardsResolver.prototype.giftCard)).toEqual([
      'giftcard:read',
    ]);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, GiftCardsResolver.prototype.giftCardByCode),
    ).toEqual(['giftcard:read']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, GiftCardsResolver.prototype.giftCardTransactions),
    ).toEqual(['giftcard:read']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, GiftCardsResolver.prototype.quoteGiftCardRedeem),
    ).toEqual(['giftcard:read']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, GiftCardsResolver.prototype.issueGiftCard),
    ).toEqual(['giftcard:issue']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, GiftCardsResolver.prototype.purchaseGiftCard),
    ).toEqual(['giftcard:purchase']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, GiftCardsResolver.prototype.redeemGiftCard),
    ).toEqual(['giftcard:redeem']);
  });

  it('PermissionsGuard denies redeemGiftCard without giftcard:redeem', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['giftcard:redeem'] : undefined,
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
              permissions: ['giftcard:read'],
            },
          },
          GiftCardsResolver.prototype.redeemGiftCard,
        ) as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('delegates issueGiftCard / redeemGiftCard to service', async () => {
    await resolver.issueGiftCard({
      currencyCode: 'USD',
      amountMinor: '5000',
    });
    expect(service.issue).toHaveBeenCalledWith({
      currencyCode: 'USD',
      amountMinor: '5000',
    });

    await resolver.redeemGiftCard({
      code: 'ABCD',
      amountMinor: '1000',
      orderId: 'o1',
    });
    expect(service.redeem).toHaveBeenCalledWith({
      code: 'ABCD',
      amountMinor: '1000',
      orderId: 'o1',
    });
  });
});
