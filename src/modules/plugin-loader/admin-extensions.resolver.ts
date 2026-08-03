import { Query, Resolver } from '@nestjs/graphql';

import { AdminExtensionRegistry } from './admin-extension-registry';
import { AdminExtensionManifestType } from './admin-extensions.types';

/**
 * Server-side admin extension manifest for the admin shell (D-06 / ADR-0006).
 */
@Resolver()
export class AdminExtensionsResolver {
  constructor(private readonly adminExtensions: AdminExtensionRegistry) {}

  @Query(() => AdminExtensionManifestType, {
    name: 'adminExtensionManifest',
    description:
      'Merged admin UI contributions from enabled plugins (no core→plugin imports)',
  })
  adminExtensionManifest(): AdminExtensionManifestType {
    return this.adminExtensions.getManifest(true);
  }
}
