import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../auth/permissions/require-permission.decorator';
import { LocalizationResolver } from './localization.resolver';

/**
 * localization GraphQL permission metadata + RBAC deny path.
 */
describe('localization RBAC (resolver metadata + PermissionsGuard deny)', () => {
  function gqlContext(req: { user?: unknown }, handler: (...args: never[]) => unknown) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => LocalizationResolver,
      getHandler: () => handler,
    };
  }

  it('LocalizationResolver declares localization:read/update', () => {
    const reflector = new Reflector();
    expect(
      reflector.get(REQUIRE_PERMISSION_KEY, LocalizationResolver.prototype.localizationSettings),
    ).toEqual(['localization:read']);
    expect(
      reflector.get(
        REQUIRE_PERMISSION_KEY,
        LocalizationResolver.prototype.updateLocalizationSettings,
      ),
    ).toEqual(['localization:update']);
  });

  it('PermissionsGuard denies update without localization:update', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['localization:update'] : undefined,
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
              permissions: ['localization:read'],
            },
          },
          LocalizationResolver.prototype.updateLocalizationSettings,
        ) as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PermissionsGuard allows read when localization:read granted', async () => {
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['localization:read'] : undefined,
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
              permissions: ['localization:read'],
            },
          },
          LocalizationResolver.prototype.localizationSettings,
        ) as never,
      ),
    ).resolves.toBe(true);
  });
});
