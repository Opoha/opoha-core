import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../auth/permissions/require-permission.decorator';
import { CouponsService } from './coupons.service';
import { DiscountRulesService } from './discount-rules.service';
import { PromotionsEngine } from './promotions-engine.service';
import { PromotionsResolver } from './promotions.resolver';

/**
 * promotions GraphQL permission metadata + resolver behavior.
 */
describe('PromotionsResolver RBAC (resolver metadata + PermissionsGuard deny)', () => {
  function gqlContext(req: { user?: unknown }, handler: (...args: never[]) => unknown) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => PromotionsResolver,
      getHandler: () => handler,
    };
  }

  it('declares promotion:read/create/update/delete permission keys', () => {
    const reflector = new Reflector();
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, PromotionsResolver.prototype.promotionProviders),
    ).toEqual(['promotion:read']);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, PromotionsResolver.prototype.couponsList)).toEqual(
      ['promotion:read'],
    );
    expect(reflector.get(REQUIRE_PERMISSION_KEY, PromotionsResolver.prototype.coupon)).toEqual([
      'promotion:read',
    ]);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, PromotionsResolver.prototype.discountRulesList),
    ).toEqual(['promotion:read']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, PromotionsResolver.prototype.discountRule),
    ).toEqual(['promotion:read']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, PromotionsResolver.prototype.applyPromotions),
    ).toEqual(['promotion:read']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, PromotionsResolver.prototype.createCoupon),
    ).toEqual(['promotion:create']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, PromotionsResolver.prototype.createDiscountRule),
    ).toEqual(['promotion:create']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, PromotionsResolver.prototype.updateCoupon),
    ).toEqual(['promotion:update']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, PromotionsResolver.prototype.updateDiscountRule),
    ).toEqual(['promotion:update']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, PromotionsResolver.prototype.deleteCoupon),
    ).toEqual(['promotion:delete']);
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, PromotionsResolver.prototype.deleteDiscountRule),
    ).toEqual(['promotion:delete']);
  });

  it('PermissionsGuard denies createCoupon without promotion:create', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['promotion:create'] : undefined,
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
              permissions: ['promotion:read'],
            },
          },
          PromotionsResolver.prototype.createCoupon,
        ) as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PermissionsGuard allows coupons when promotion:read granted', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn().mockReturnValue(['promotion:read']),
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
              permissions: ['promotion:read'],
            },
          },
          PromotionsResolver.prototype.couponsList,
        ) as never,
      ),
    ).resolves.toBe(true);
  });
});

describe('PromotionsResolver behavior', () => {
  let engine: {
    list: ReturnType<typeof vi.fn>;
    apply: ReturnType<typeof vi.fn>;
  };
  let coupons: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let discountRules: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let resolver: PromotionsResolver;

  beforeEach(() => {
    engine = {
      list: vi.fn(() => [{ code: 'typeorm', displayName: 'Core TypeORM promotions' }]),
      apply: vi.fn(async () => ({
        currencyCode: 'USD',
        discountMinor: '500',
        freeShipping: false,
        applications: [
          {
            code: 'SAVE10',
            kind: 'coupon',
            discountMinor: '300',
            label: 'Save 10%',
          },
          {
            code: 'AUTO5',
            kind: 'automatic',
            discountMinor: '200',
          },
        ],
        metadata: { source: 'test' },
      })),
    };
    coupons = {
      findAll: vi.fn(async () => [
        {
          id: 'c1',
          code: 'SAVE10',
          name: 'Save 10%',
          description: null,
          kind: 'percentage',
          valueBps: 1000,
          amountMinor: null,
          currencyCode: null,
          minSubtotalMinor: null,
          maxUses: null,
          maxUsesPerCustomer: null,
          usageCount: 0,
          priority: 0,
          startsAt: null,
          endsAt: null,
          isActive: true,
          metadataJson: null,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ]),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    discountRules = {
      findAll: vi.fn(async () => [
        {
          id: 'd1',
          code: 'AUTO5',
          name: 'Auto 5%',
          description: null,
          kind: 'percentage',
          valueBps: 500,
          amountMinor: null,
          currencyCode: null,
          minSubtotalMinor: null,
          priority: 10,
          stackable: false,
          startsAt: null,
          endsAt: null,
          isActive: true,
          conditionsJson: null,
          metadataJson: null,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ]),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    resolver = new PromotionsResolver(
      engine as unknown as PromotionsEngine,
      coupons as unknown as CouponsService,
      discountRules as unknown as DiscountRulesService,
    );
  });

  it('promotionProviders lists registered providers', () => {
    expect(resolver.promotionProviders()).toEqual([
      { code: 'typeorm', displayName: 'Core TypeORM promotions' },
    ]);
  });

  it('couponsList delegates to CouponsService', async () => {
    const result = await resolver.couponsList();
    expect(coupons.findAll).toHaveBeenCalledOnce();
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('SAVE10');
  });

  it('discountRulesList delegates to DiscountRulesService', async () => {
    const result = await resolver.discountRulesList();
    expect(discountRules.findAll).toHaveBeenCalledOnce();
    expect(result[0]!.code).toBe('AUTO5');
  });

  it('applyPromotions maps coupon + automatic discount applications', async () => {
    const result = await resolver.applyPromotions({
      currencyCode: 'USD',
      couponCode: 'SAVE10',
      subtotalMinor: '5000',
      items: [
        {
          quantity: 2,
          unitAmountMinor: '2500',
          sku: 'SKU-1',
        },
      ],
    });
    expect(engine.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        currencyCode: 'USD',
        couponCode: 'SAVE10',
        subtotalMinor: '5000',
        items: [
          {
            sku: 'SKU-1',
            productId: undefined,
            variantId: undefined,
            quantity: 2,
            unitAmountMinor: '2500',
          },
        ],
      }),
      undefined,
    );
    expect(result.discountMinor).toBe('500');
    expect(result.applications).toHaveLength(2);
    expect(result.applications[0]!.kind).toBe('coupon');
    expect(result.applications[1]!.kind).toBe('automatic');
    expect(result.metadataJson).toBe('{"source":"test"}');
  });

  it('applyPromotions rejects invalid metadataJson', async () => {
    await expect(
      resolver.applyPromotions({
        currencyCode: 'USD',
        items: [{ quantity: 1, unitAmountMinor: '100' }],
        metadataJson: 'not-json',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createCoupon delegates to CouponsService', async () => {
    coupons.create.mockResolvedValueOnce({ id: 'c2', code: 'NEW' });
    await resolver.createCoupon({
      code: 'new',
      name: 'New',
      kind: 'percentage',
      valueBps: 1000,
    });
    expect(coupons.create).toHaveBeenCalledOnce();
  });
});
