import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable, OnModuleInit, Optional } from '@nestjs/common';

import { ConfigService } from '../config/config.service';
import { AppLogger } from '../logging/app-logger';
import { orderPluginsByDependency } from './dependency-order';
import {
  discoverPlugins,
  discoverPluginsInDirectory,
  parsePluginPathsEnv,
} from './plugin-discovery';
import type { DiscoveredPlugin } from './plugin-manifest';

export type PluginLoadResult = {
  ordered: DiscoveredPlugin[];
  /** Manifest + entry path checks that passed without executing plugin code. */
  validated: Array<{ id: string; entryPath: string }>;
};

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

  /**
   * Re-read plugin config, discover, and store dependency order.
   * Does not execute plugin entry modules (see {@link load}).
   */
  reload(): DiscoveredPlugin[] {
    const discovered = this.discoverConfigured();
    if (discovered.length === 0) {
      this.ordered = [];
      this.logger?.log(
        'No plugins configured (OPOHA_PLUGINS / OPOHA_PLUGINS_PATH empty)',
        'PluginLoaderService',
      );
      return this.ordered;
    }
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

  /**
   * Stub load: discover + topological order + validate manifests/entry paths
   * without requiring or executing real plugin modules (D-03).
   * Full install/boot lands in D-04.
   */
  load(): PluginLoadResult {
    const ordered = this.reload();
    const validated: PluginLoadResult['validated'] = [];
    for (const plugin of ordered) {
      const entryPath = join(plugin.rootPath, plugin.manifest.entry);
      // Entry file may not exist yet during scaffold; warn but do not fail stub load
      // unless the plugin is marked required.
      if (!existsSync(entryPath) && plugin.manifest.required) {
        throw new Error(
          `Required plugin "${plugin.manifest.id}" entry not found: ${entryPath}`,
        );
      }
      validated.push({ id: plugin.manifest.id, entryPath });
    }
    return { ordered, validated };
  }

  getOrderedPlugins(): readonly DiscoveredPlugin[] {
    return this.ordered;
  }

  private discoverConfigured(): DiscoveredPlugin[] {
    const paths = parsePluginPathsEnv(this.config.get('OPOHA_PLUGINS'));
    const fromList = discoverPlugins(paths);
    const pluginsPath = this.config.get('OPOHA_PLUGINS_PATH')?.trim();
    const fromDir =
      pluginsPath && pluginsPath.length > 0
        ? discoverPluginsInDirectory(pluginsPath)
        : [];

    const byId = new Map<string, DiscoveredPlugin>();
    for (const plugin of [...fromList, ...fromDir]) {
      if (byId.has(plugin.manifest.id)) {
        throw new Error(
          `Duplicate plugin id "${plugin.manifest.id}" across OPOHA_PLUGINS / OPOHA_PLUGINS_PATH`,
        );
      }
      byId.set(plugin.manifest.id, plugin);
    }
    return [...byId.values()];
  }
}
