import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { GqlAuthGuard } from './gql-auth.guard';

describe('GqlAuthGuard', () => {
  it('extracts the GraphQL HTTP request from context', () => {
    const guard = new GqlAuthGuard();
    const req = { headers: { authorization: 'Bearer tok' } };
    const context = {
      getType: () => 'graphql',
      getArgs: () => [{}, {}, { req }, {}],
      getClass: () => class {},
      getHandler: () => function handler() {},
      switchToHttp: () => ({ getRequest: () => req }),
    };
    // GqlExecutionContext.create expects a Nest ExecutionContext; cast for unit isolation.
    const extracted = guard.getRequest(context as never);
    expect(extracted).toBe(req);
  });

  it('rejects when passport yields no user', () => {
    const guard = new GqlAuthGuard();
    expect(() => guard.handleRequest(null, false)).toThrow(UnauthorizedException);
  });

  it('returns the authenticated user', () => {
    const guard = new GqlAuthGuard();
    const user = { userId: 'u1', email: 'a@b.c' };
    expect(guard.handleRequest(null, user)).toEqual(user);
  });

  it('rethrows passport errors', () => {
    const guard = new GqlAuthGuard();
    const err = new UnauthorizedException('bad token');
    expect(() => guard.handleRequest(err, false)).toThrow(err);
  });
});
