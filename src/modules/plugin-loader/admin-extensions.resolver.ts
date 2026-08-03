import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from '../auth/jwt/gql-auth.guard';
import { PermissionsGuard } from '../auth/permissions/permissions.guard';
import { RequirePermission } from '../auth/permissions/require-permission.decorator';
import { AdminExtensionRegistry } from './admin-extension-registry';
import { AdminExtensionManifestType } from './admin-extensions.types';

/**
 * Server-side admin extension manifest for the admin shell (D-06 / ADR-0006).
 * Staff-authenticated; requires `plugin:read`.
 */
@Resolver()
@UseGuards(GqlAuthGuard, PermissionsGuard)
export class AdminExtensionsResolver {
  constructor(private readonly adminExtensions: AdminExtensionRegistry) {}

  @Query(() => AdminExtensionManifestType, {
    name: 'adminExtensionManifest',
    description:
      'Merged admin UI contributions from enabled plugins (no core→plugin imports)',
  })
  @RequirePermission('plugin:read')
  adminExtensionManifest(): AdminExtensionManifestType {
    return this.adminExtensions.getManifest(true);
  }
}
