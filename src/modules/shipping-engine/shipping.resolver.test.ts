import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../auth/permissions/require-permission.decorator';
import { ShippingEngine } from './shipping-engine.service';
import { ShippingResolver } from './shipping.resolver';

/**
 * B-05 — shipping GraphQL permission metadata + resolver behavior.
 */
describe('ShippingResolver RBAC (resolver metadata + PermissionsGuard deny)', () => {
  function gqlContext(
    req: { user?: unknown },
    handler: (...args: never[]) => unknown,
  ) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => ShippingResolver,
      getHandler: () => handler,
    };
  }

  it('declares shipping:read permission keys', () => {
    const reflector = new Reflector();
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        ShippingResolver.prototype.shippingMethods,
      ),
    ).toEqual(['shipping:read']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        ShippingResolver.prototype.quoteShippingRates,
      ),
    ).toEqual(['shipping:read']);
  });

  it('PermissionsGuard denies quoteShippingRates without shipping:read', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['shipping:read'] : undefined,
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
          ShippingResolver.prototype.quoteShippingRates,
        ) as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PermissionsGuard allows shippingMethods when shipping:read granted', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn().mockReturnValue(['shipping:read']),
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
              permissions: ['shipping:read'],
            },
          },
          ShippingResolver.prototype.shippingMethods,
        ) as never,
      ),
    ).resolves.toBe(true);
  });
});

describe('ShippingResolver behavior', () => {
  let engine: {
    list: ReturnType<typeof vi.fn>;
    quote: ReturnType<typeof vi.fn>;
  };
  let resolver: ShippingResolver;

  beforeEach(() => {
    engine = {
      list: vi.fn(() => [
        { code: 'flat-rate', displayName: 'Flat rate' },
        { code: 'dhl', displayName: 'DHL Express' },
      ]),
      quote: vi.fn(async () => ({
        currencyCode: 'USD',
        rates: [
          {
            methodCode: 'flat-rate',
            methodDisplayName: 'Flat rate',
            code: 'flat-rate',
            displayName: 'Flat rate',
            amount: { amountMinor: '500', currencyCode: 'USD' },
          },
          {
            methodCode: 'dhl',
            methodDisplayName: 'DHL Express',
            code: 'P',
            displayName: 'DHL EXPRESS WORLDWIDE',
            amount: { amountMinor: '2063', currencyCode: 'USD' },
            minTransitDays: 3,
            maxTransitDays: 3,
            metadata: { localProductCode: 'P' },
          },
        ],
      })),
    };
    resolver = new ShippingResolver(engine as unknown as ShippingEngine);
  });

  it('shippingMethods lists registered methods (flat-rate + carrier)', () => {
    const result = resolver.shippingMethods();
    expect(result).toEqual([
      { code: 'flat-rate', displayName: 'Flat rate' },
      { code: 'dhl', displayName: 'DHL Express' },
    ]);
    expect(engine.list).toHaveBeenCalled();
  });

  it('quoteShippingRates maps engine rates including carrier transit + metadata', async () => {
    const result = await resolver.quoteShippingRates({
      currencyCode: 'USD',
      destination: { countryCode: 'US', postalCode: '10001' },
      items: [{ quantity: 1, unitAmountMinor: '1000', weightGrams: 500 }],
      subtotalMinor: '1000',
    });

    expect(engine.quote).toHaveBeenCalledWith({
      currencyCode: 'USD',
      destination: {
        countryCode: 'US',
        postalCode: '10001',
        province: undefined,
        city: undefined,
        line1: undefined,
        line2: undefined,
      },
      origin: undefined,
      items: [
        {
          sku: undefined,
          productId: undefined,
          variantId: undefined,
          quantity: 1,
          unitAmountMinor: '1000',
          weightGrams: 500,
        },
      ],
      subtotalMinor: '1000',
      metadata: undefined,
    });

    expect(result.currencyCode).toBe('USD');
    expect(result.rates).toHaveLength(2);
    expect(result.rates[0]).toMatchObject({
      methodCode: 'flat-rate',
      code: 'flat-rate',
      amount: { amountMinor: '500', currencyCode: 'USD' },
      minTransitDays: null,
      metadataJson: null,
    });
    expect(result.rates[1]).toMatchObject({
      methodCode: 'dhl',
      code: 'P',
      minTransitDays: 3,
      maxTransitDays: 3,
      metadataJson: JSON.stringify({ localProductCode: 'P' }),
    });
  });

  it('quoteShippingRates rejects invalid metadataJson', async () => {
    await expect(
      resolver.quoteShippingRates({
        currencyCode: 'USD',
        destination: { countryCode: 'US' },
        items: [{ quantity: 1, unitAmountMinor: '1000' }],
        metadataJson: 'not-json',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(engine.quote).not.toHaveBeenCalled();
  });

  it('quoteShippingRates forwards parsed metadataJson', async () => {
    await resolver.quoteShippingRates({
      currencyCode: 'USD',
      destination: { countryCode: 'TH' },
      items: [{ quantity: 2, unitAmountMinor: '2500' }],
      metadataJson: JSON.stringify({ channel: 'web' }),
    });
    expect(engine.quote).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { channel: 'web' },
      }),
    );
  });
});
