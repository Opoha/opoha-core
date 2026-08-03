import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

import type { AuthUser } from '../jwt/auth-user';
import { PermissionsService } from './permissions.service';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext<{ req: { user?: AuthUser } }>().req;
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Permission check requires authentication');
    }

    const granted =
      user.permissions ??
      (await this.permissionsService.listKeysForUser(user.userId));

    const missing = required.filter((key) => !granted.includes(key));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing permission(s): ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
