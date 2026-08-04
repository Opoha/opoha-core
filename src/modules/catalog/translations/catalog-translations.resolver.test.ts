import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../../auth/permissions/require-permission.decorator';
import { CatalogTranslationsResolver } from './catalog-translations.resolver';
import type { CatalogTranslationsService } from './catalog-translations.service';

/**
 * C-03 — translation GraphQL permission metadata + PermissionsGuard deny path.
 */
describe('CatalogTranslationsResolver RBAC (C-03)', () => {
  function gqlContext(req: { user?: unknown }, handler: (...args: never[]) => unknown) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => CatalogTranslationsResolver,
      getHandler: () => handler,
    };
  }

  it('declares translation:read / translation:update permission keys', () => {
    const reflector = new Reflector();
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        CatalogTranslationsResolver.prototype.productTranslations,
      ),
    ).toEqual(['translation:read']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        CatalogTranslationsResolver.prototype.categoryTranslations,
      ),
    ).toEqual(['translation:read']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        CatalogTranslationsResolver.prototype.upsertProductTranslation,
      ),
    ).toEqual(['translation:update']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        CatalogTranslationsResolver.prototype.upsertCategoryTranslation,
      ),
    ).toEqual(['translation:update']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        CatalogTranslationsResolver.prototype.deleteProductTranslation,
      ),
    ).toEqual(['translation:update']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        CatalogTranslationsResolver.prototype.deleteCategoryTranslation,
      ),
    ).toEqual(['translation:update']);
  });

  it('PermissionsGuard denies upsert without translation:update', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['translation:update'] : undefined,
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
              permissions: ['translation:read'],
            },
          },
          CatalogTranslationsResolver.prototype.upsertProductTranslation,
        ) as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PermissionsGuard allows list when translation:read granted', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['translation:read'] : undefined,
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
              permissions: ['translation:read'],
            },
          },
          CatalogTranslationsResolver.prototype.productTranslations,
        ) as never,
      ),
    ).resolves.toBe(true);
  });

  it('resolver delegates upsert/list to CatalogTranslationsService', async () => {
    const service = {
      listProductTranslations: vi.fn(async () => [
        { id: 't1', productId: 'p1', locale: 'th-TH', name: 'เสื้อ' },
      ]),
      upsertProductTranslation: vi.fn(async (input: { locale: string }) => ({
        id: 't1',
        productId: 'p1',
        locale: input.locale,
        name: 'เสื้อ',
      })),
    };
    const resolver = new CatalogTranslationsResolver(
      service as unknown as CatalogTranslationsService,
    );
    await expect(resolver.productTranslations('p1')).resolves.toMatchObject([{ locale: 'th-TH' }]);
    await expect(
      resolver.upsertProductTranslation({
        productId: 'p1',
        locale: 'th-TH',
        name: 'เสื้อ',
      }),
    ).resolves.toMatchObject({ locale: 'th-TH', name: 'เสื้อ' });
    expect(service.listProductTranslations).toHaveBeenCalledWith('p1');
    expect(service.upsertProductTranslation).toHaveBeenCalled();
  });
});
