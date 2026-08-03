import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

/**
 * Declare one or more permission keys required for a GraphQL handler.
 * Used with PermissionsGuard (and typically GqlAuthGuard).
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
