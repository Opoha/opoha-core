import { Injectable, OnModuleInit, Optional } from '@nestjs/common';

import { ConfigService } from '../config/config.service';
import { AppLogger } from '../logging/app-logger';
import { orderPluginsByDependency } from './dependency-order';
import {
  discoverPlugins,
  parsePluginPathsEnv,
} from './plugin-discovery';
import type { DiscoveredPlugin } from './plugin-manifest';

/**
 * Discovers configured plugins, parses manifests, and resolves dependency order.
 * Lifecycle install/boot (D-04) builds on this ordered list.
 */
@Injectable()
export class PluginLoaderService implements OnModuleInit {
  private ordered: DiscoveredPlugin[] = [];

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly logger?: AppLogger,
  ) {}

  onModuleInit(): void {
    this.reload();
  }

  /** Re-read OPOHA_PLUGINS and rebuild the ordered discovery list. */
  reload(): DiscoveredPlugin[] {
    const paths = parsePluginPathsEnv(this.config.get('OPOHA_PLUGINS'));
    if (paths.length === 0) {
      this.ordered = [];
      this.logger?.log('No plugins configured (OPOHA_PLUGINS empty)', 'PluginLoaderService');
      return this.ordered;
    }
    const discovered = discoverPlugins(paths);
    this.ordered = orderPluginsByDependency(discovered);
    this.logger?.log(
      {
        message: 'Plugins discovered',
        count: this.ordered.length,
        order: this.ordered.map((p) => p.manifest.id),
      },
      'PluginLoaderService',
    );
    return this.ordered;
  }

  getOrderedPlugins(): readonly DiscoveredPlugin[] {
    return this.ordered;
  }
}
