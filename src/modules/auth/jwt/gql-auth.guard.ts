import {
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

/**
 * Passport JWT guard adapted for Nest GraphQL resolvers.
 * Expects `Authorization: Bearer <token>` on the HTTP request.
 */
@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  override getRequest(context: ExecutionContext): {
    headers: Record<string, unknown>;
  } {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext<{ req: { headers: Record<string, unknown> } }>().req;
  }

  override handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
