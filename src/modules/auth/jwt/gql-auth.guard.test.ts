import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { GqlAuthGuard } from './gql-auth.guard';

describe('GqlAuthGuard', () => {
  const apiKeysService = {
    authenticate: vi.fn(),
  };

  it('extracts the GraphQL HTTP request from context', () => {
    const guard = new GqlAuthGuard(apiKeysService as never);
    const req = { headers: { authorization: 'Bearer tok' } };
    const context = {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => class {},
      getHandler: () => function handler() {},
      switchToHttp: () => ({ getRequest: () => req }),
    };
    const extracted = guard.getRequest(context as never);
    expect(extracted).toBe(req);
  });

  it('rejects when passport yields no user', () => {
    const guard = new GqlAuthGuard(apiKeysService as never);
    expect(() => guard.handleRequest(null, false)).toThrow(UnauthorizedException);
  });

  it('returns the authenticated user', () => {
    const guard = new GqlAuthGuard(apiKeysService as never);
    const user = { userId: 'u1', email: 'a@b.c' };
    expect(guard.handleRequest(null, user)).toEqual(user);
  });

  it('rethrows passport errors', () => {
    const guard = new GqlAuthGuard(apiKeysService as never);
    const err = new UnauthorizedException('bad token');
    expect(() => guard.handleRequest(err, false)).toThrow(err);
  });

  it('authenticates via X-API-Key without JWT', async () => {
    const authUser = {
      userId: 'u1',
      email: 'a@b.c',
      apiKeyId: 'ak-1',
      permissions: ['user:read'],
    };
    apiKeysService.authenticate.mockResolvedValue(authUser);
    const guard = new GqlAuthGuard(apiKeysService as never);
    const req = { headers: { 'x-api-key': 'opk_secret' }, user: undefined as unknown };
    const context = {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => class {},
      getHandler: () => function handler() {},
      switchToHttp: () => ({ getRequest: () => req }),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(apiKeysService.authenticate).toHaveBeenCalledWith('opk_secret');
    expect(req.user).toEqual(authUser);
  });
});
