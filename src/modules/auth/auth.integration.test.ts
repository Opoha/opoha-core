import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { GqlAuthGuard } from './jwt/gql-auth.guard';
import { PermissionsGuard } from './permissions/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from './permissions/require-permission.decorator';

/**
 * C-09 — integration-style coverage for auth guard, RBAC deny, and API key auth
 * without requiring a live Postgres (guards + permission resolution path).
 * Maps to AC-MVP-016 / AC-MVP-019 / AC-MVP-020.
 */
describe('auth integration (guards + RBAC + API key)', () => {
  function gqlContext(req: {
    headers: Record<string, unknown>;
    user?: unknown;
  }) {
    return {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => class {},
      getHandler: () => function handler() {},
      switchToHttp: () => ({ getRequest: () => req }),
    };
  }

  it('GqlAuthGuard rejects unauthenticated GraphQL requests via handleRequest', () => {
    const guard = new GqlAuthGuard({ authenticate: vi.fn() } as never);
    expect(() => guard.handleRequest(null, false)).toThrow(
      UnauthorizedException,
    );
  });

  it('GqlAuthGuard authenticates X-API-Key and PermissionsGuard enforces scoped allow', async () => {
    const authUser = {
      userId: 'u1',
      email: 'bot@example.com',
      apiKeyId: 'ak-1',
      permissions: ['user:read'],
    };
    const apiKeysService = {
      authenticate: vi.fn().mockResolvedValue(authUser),
    };
    const authGuard = new GqlAuthGuard(apiKeysService as never);
    const req = {
      headers: { 'x-api-key': 'opk_secret' },
      user: undefined as unknown,
    };
    const ctx = gqlContext(req);

    await expect(authGuard.canActivate(ctx as never)).resolves.toBe(true);
    expect(req.user).toEqual(authUser);

    const permissionsGuard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn((key: string) =>
          key === REQUIRE_PERMISSION_KEY ? ['user:read'] : undefined,
        ),
      } as unknown as Reflector,
      { listKeysForUser: vi.fn() } as never,
    );
    await expect(permissionsGuard.canActivate(ctx as never)).resolves.toBe(
      true,
    );
  });

  it('PermissionsGuard denies when API key lacks required permission (RBAC deny)', async () => {
    const req = {
      headers: {},
      user: {
        userId: 'u1',
        email: 'bot@example.com',
        apiKeyId: 'ak-1',
        permissions: ['user:read'],
      },
    };
    const permissionsGuard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn().mockReturnValue(['user:create']),
      } as unknown as Reflector,
      { listKeysForUser: vi.fn() } as never,
    );
    await expect(
      permissionsGuard.canActivate(gqlContext(req) as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PermissionsGuard loads role permissions for JWT users and denies missing ones', async () => {
    const listKeysForUser = vi.fn().mockResolvedValue(['role:read']);
    const req = {
      headers: { authorization: 'Bearer jwt' },
      user: { userId: 'u1', email: 'admin@example.com' },
    };
    const permissionsGuard = new PermissionsGuard(
      {
        getAllAndOverride: vi.fn().mockReturnValue(['user:delete']),
      } as unknown as Reflector,
      { listKeysForUser } as never,
    );
    await expect(
      permissionsGuard.canActivate(gqlContext(req) as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(listKeysForUser).toHaveBeenCalledWith('u1');
  });
});
