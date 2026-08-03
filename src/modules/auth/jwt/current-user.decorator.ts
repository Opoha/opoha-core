import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import type { AuthUser } from './auth-user';

/**
 * Current authenticated staff user from JWT (requires GqlAuthGuard).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext<{ req: { user?: AuthUser } }>().req;
    return request.user;
  },
);
