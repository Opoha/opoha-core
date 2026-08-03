import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from './permissions.guard';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator';

function mockContext(user: unknown) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    getType: () => 'graphql',
    getArgs: () => [{}, {}, { req: { user } }, {}],
  } as never;
}

describe('PermissionsGuard', () => {
  it('allows when no permission metadata is set', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    };
    const permissionsService = { listKeysForUser: vi.fn() };
    const guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      permissionsService as never,
    );
    await expect(guard.canActivate(mockContext({ userId: 'u1' }))).resolves.toBe(
      true,
    );
  });

  it('allows when user has required permission', async () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: string) =>
        key === REQUIRE_PERMISSION_KEY ? ['user:read'] : undefined,
      ),
    };
    const permissionsService = {
      listKeysForUser: vi.fn().mockResolvedValue(['user:read', 'user:create']),
    };
    const guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      permissionsService as never,
    );
    await expect(
      guard.canActivate(mockContext({ userId: 'u1' })),
    ).resolves.toBe(true);
  });

  it('denies when permission is missing', async () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['user:delete']),
    };
    const permissionsService = {
      listKeysForUser: vi.fn().mockResolvedValue(['user:read']),
    };
    const guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      permissionsService as never,
    );
    await expect(
      guard.canActivate(mockContext({ userId: 'u1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('uses API-key scoped permissions when present on AuthUser', async () => {
    const listKeysForUser = vi.fn();
    const guard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn().mockReturnValue(['api-key:read']),
      } as unknown as Reflector,
      { listKeysForUser } as never,
    );
    await expect(
      guard.canActivate(
        mockContext({
          userId: 'u1',
          permissions: ['api-key:read'],
        }),
      ),
    ).resolves.toBe(true);
    expect(listKeysForUser).not.toHaveBeenCalled();
  });
});
