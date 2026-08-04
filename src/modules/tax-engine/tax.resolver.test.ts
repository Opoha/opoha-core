import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../auth/permissions/require-permission.decorator';
import { TaxClassesService } from './tax-classes.service';
import { TaxEngine } from './tax-engine.service';
import { TaxRulesService } from './tax-rules.service';
import { TaxResolver } from './tax.resolver';

/**
 * C-05 — tax GraphQL permission metadata + resolver behavior.
 */
describe('TaxResolver RBAC (resolver metadata + PermissionsGuard deny)', () => {
  function gqlContext(req: { user?: unknown }, handler: (...args: never[]) => unknown) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => TaxResolver,
      getHandler: () => handler,
    };
  }

  it('declares tax:read/create/update/delete permission keys', () => {
    const reflector = new Reflector();
    expect(reflector.get(REQUIRE_PERMISSION_KEY, TaxResolver.prototype.taxProviders)).toEqual([
      'tax:read',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, TaxResolver.prototype.taxClassesList)).toEqual([
      'tax:read',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, TaxResolver.prototype.taxClass)).toEqual([
      'tax:read',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, TaxResolver.prototype.taxRulesList)).toEqual([
      'tax:read',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, TaxResolver.prototype.taxRule)).toEqual([
      'tax:read',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, TaxResolver.prototype.calculateTax)).toEqual([
      'tax:read',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, TaxResolver.prototype.createTaxClass)).toEqual([
      'tax:create',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, TaxResolver.prototype.createTaxRule)).toEqual([
      'tax:create',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, TaxResolver.prototype.updateTaxClass)).toEqual([
      'tax:update',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, TaxResolver.prototype.updateTaxRule)).toEqual([
      'tax:update',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, TaxResolver.prototype.deleteTaxClass)).toEqual([
      'tax:delete',
    ]);
    expect(reflector.get(REQUIRE_PERMISSION_KEY, TaxResolver.prototype.deleteTaxRule)).toEqual([
      'tax:delete',
    ]);
  });

  it('PermissionsGuard denies createTaxClass without tax:create', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['tax:create'] : undefined,
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
              permissions: ['tax:read'],
            },
          },
          TaxResolver.prototype.createTaxClass,
        ) as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PermissionsGuard allows taxClasses when tax:read granted', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn().mockReturnValue(['tax:read']),
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
              permissions: ['tax:read'],
            },
          },
          TaxResolver.prototype.taxClassesList,
        ) as never,
      ),
    ).resolves.toBe(true);
  });
});

describe('TaxResolver behavior', () => {
  let engine: {
    list: ReturnType<typeof vi.fn>;
    calculate: ReturnType<typeof vi.fn>;
  };
  let taxClasses: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let taxRules: {
    findAll: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let resolver: TaxResolver;

  beforeEach(() => {
    engine = {
      list: vi.fn(() => [{ code: 'standard', displayName: 'Standard tax' }]),
      calculate: vi.fn(async () => ({
        currencyCode: 'USD',
        pricingMode: 'exclusive',
        taxMinor: '200',
        lines: [
          {
            lineIndex: 0,
            taxClassCode: 'standard',
            rateBps: 1000,
            taxAmountMinor: '200',
            taxableAmountMinor: '2000',
            name: 'US standard',
          },
        ],
        metadata: { source: 'test' },
      })),
    };
    taxClasses = {
      findAll: vi.fn(async () => [
        {
          id: 'tc1',
          code: 'standard',
          name: 'Standard',
          description: null,
          isActive: true,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ]),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    taxRules = {
      findAll: vi.fn(async () => []),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    resolver = new TaxResolver(
      engine as unknown as TaxEngine,
      taxClasses as unknown as TaxClassesService,
      taxRules as unknown as TaxRulesService,
    );
  });

  it('taxProviders lists registered providers', () => {
    expect(resolver.taxProviders()).toEqual([{ code: 'standard', displayName: 'Standard tax' }]);
  });

  it('taxClassesList delegates to TaxClassesService', async () => {
    const result = await resolver.taxClassesList();
    expect(taxClasses.findAll).toHaveBeenCalledOnce();
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('standard');
  });

  it('calculateTax maps engine result including exclusive taxMinor', async () => {
    const result = await resolver.calculateTax({
      currencyCode: 'USD',
      pricingMode: 'exclusive',
      items: [
        {
          quantity: 2,
          unitAmountMinor: '1000',
          taxClassCode: 'standard',
        },
      ],
      address: { countryCode: 'US' },
    });
    expect(engine.calculate).toHaveBeenCalledWith(
      expect.objectContaining({
        currencyCode: 'USD',
        pricingMode: 'exclusive',
        address: { countryCode: 'US' },
        items: [
          {
            sku: undefined,
            productId: undefined,
            variantId: undefined,
            taxClassCode: 'standard',
            quantity: 2,
            unitAmountMinor: '1000',
          },
        ],
      }),
      undefined,
    );
    expect(result.taxMinor).toBe('200');
    expect(result.pricingMode).toBe('exclusive');
    expect(result.metadataJson).toBe('{"source":"test"}');
    expect(result.lines[0]!.rateBps).toBe(1000);
  });

  it('calculateTax maps inclusive mode through to engine', async () => {
    engine.calculate.mockResolvedValueOnce({
      currencyCode: 'USD',
      pricingMode: 'inclusive',
      taxMinor: '181',
      lines: [],
    });
    const result = await resolver.calculateTax({
      currencyCode: 'USD',
      pricingMode: 'inclusive',
      items: [{ quantity: 1, unitAmountMinor: '2000', taxClassCode: 'standard' }],
      providerCode: 'standard',
    });
    expect(engine.calculate).toHaveBeenCalledWith(
      expect.objectContaining({ pricingMode: 'inclusive' }),
      'standard',
    );
    expect(result.taxMinor).toBe('181');
    expect(result.pricingMode).toBe('inclusive');
  });

  it('calculateTax rejects invalid metadataJson', async () => {
    await expect(
      resolver.calculateTax({
        currencyCode: 'USD',
        pricingMode: 'exclusive',
        items: [{ quantity: 1, unitAmountMinor: '100' }],
        metadataJson: 'not-json',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
