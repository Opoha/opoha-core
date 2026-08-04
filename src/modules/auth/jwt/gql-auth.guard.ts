import { type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

import { ApiKeysService } from '../api-keys/api-keys.service';
import type { AuthUser } from './auth-user';

const API_KEY_HEADER = 'x-api-key';

type GqlRequest = {
  headers: Record<string, unknown>;
  user?: AuthUser;
};

/**
 * Passport JWT guard adapted for Nest GraphQL resolvers.
 * Accepts `Authorization: Bearer <jwt>` or `X-API-Key: <secret>` (API key wins when present).
 */
@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly apiKeysService: ApiKeysService) {
    super();
  }

  override getRequest(context: ExecutionContext): GqlRequest {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext<{ req: GqlRequest }>().req;
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = this.getRequest(context);
    const apiKey = extractApiKey(req.headers);
    if (apiKey) {
      req.user = await this.apiKeysService.authenticate(apiKey);
      return true;
    }
    return (await super.canActivate(context)) as boolean;
  }

  override handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Authentication required');
    }
    return user;
  }
}

function extractApiKey(headers: Record<string, unknown>): string | undefined {
  const raw = headers[API_KEY_HEADER] ?? headers['X-API-Key'];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim()) {
    return raw[0].trim();
  }
  return undefined;
}
