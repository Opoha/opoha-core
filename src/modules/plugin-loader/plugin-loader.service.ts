import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Injectable, OnModuleInit, Optional } from '@nestjs/common';

import { ConfigService } from '../config/config.service';
import { FXRateProviderRegistry } from '../currency/public';
import { StorageAdapterRegistry } from '../files/public';
import { JobsService, ScheduledJobRegistry } from '../jobs/public';
import { AppLogger } from '../logging/app-logger';
import { NotificationProviderRegistry } from '../notifications/public';
import { PaymentProviderRegistry } from '../payment-engine/public';
import { PromotionRuleRegistry } from '../promotions-engine/public';
import { RuleActionRegistry } from '../rules/public';
import { SearchProviderRegistry } from '../search-engine/public';
import { ShippingMethodRegistry } from '../shipping-engine/public';
import { TaxProviderRegistry } from '../tax-engine/public';
import { AdminExtensionRegistry } from './admin-extension-registry';
import { ContributionRegistry } from './contribution-registry';
import { orderPluginsByDependency } from './dependency-order';
import {
  discoverPlugins,
  discoverPluginsInDirectory,
  parsePluginPathsEnv,
} from './plugin-discovery';
import type { PluginDefinition } from './plugin-definition';
import { createPluginRegistrationContext } from './plugin-definition';
import {
  canBootPlugin,
  transitionPluginState,
  type PluginLifecycleState,
} from './plugin-lifecycle';
import type { DiscoveredPlugin } from './plugin-manifest';
import { PLUGIN_CONTRACT_VERSION } from './plugin-manifest';

export type PluginLoadResult = {
  ordered: DiscoveredPlugin[];
  /** Manifest + entry path checks that passed without executing plugin code. */
  validated: Array<{ id: string; entryPath: string }>;
  /** Definitions imported from plugin entry modules (D-11). */
  loaded: Array<{ id: string; entryPath: string }>;
};

export type PluginRuntimeRecord = {
  discovered: DiscoveredPlugin;
  state: PluginLifecycleState;
  definition?: PluginDefinition;
  booted: boolean;
};

/**
 * Discovers plugins, runs lifecycle hooks, and wires registration surfaces (D-03–D-06).
 */
@Injectable()
export class PluginLoaderService implements OnModuleInit {
  private ordered: DiscoveredPlugin[] = [];
  private readonly records = new Map<string, PluginRuntimeRecord>();

  constructor(
    private readonly config: ConfigService,
    private readonly contributions: ContributionRegistry,
    private readonly adminExtensions: AdminExtensionRegistry,
    private readonly paymentProviders: PaymentProviderRegistry,
    private readonly shippingMethods: ShippingMethodRegistry,
    private readonly taxProviders: TaxProviderRegistry,
    private readonly promotionRules: PromotionRuleRegistry,
    private readonly notificationProviders: NotificationProviderRegistry,
    private readonly storageAdapters: StorageAdapterRegistry,
    private readonly searchProviders: SearchProviderRegistry,
    private readonly fxProviders: FXRateProviderRegistry,
    @Optional() private readonly jobsService?: JobsService,
    @Optional() private readonly scheduledJobs?: ScheduledJobRegistry,
    @Optional() private readonly ruleActions?: RuleActionRegistry,
    @Optional() private readonly logger?: AppLogger,
  ) {}

  onModuleInit(): void {
    this.reload();
  }

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
    for (const plugin of this.ordered) {
      const id = plugin.manifest.id;
      const existing = this.records.get(id);
      if (!existing) {
        this.records.set(id, {
          discovered: plugin,
          state: 'discovered',
          booted: false,
        });
      } else {
        existing.discovered = plugin;
      }
    }
    this.logger?.log(
      `Plugins discovered: count=${this.ordered.length} order=${this.ordered.map((p) => p.manifest.id).join(',')}`,
      'PluginLoaderService',
    );
    return this.ordered;
  }

  load(): PluginLoadResult {
    const ordered = this.reload();
    const validated: PluginLoadResult['validated'] = [];
    for (const plugin of ordered) {
      const entryPath = join(plugin.rootPath, plugin.manifest.entry);
      if (!existsSync(entryPath) && plugin.manifest.required) {
        throw new Error(`Required plugin "${plugin.manifest.id}" entry not found: ${entryPath}`);
      }
      validated.push({ id: plugin.manifest.id, entryPath });
    }
    return { ordered, validated, loaded: [] };
  }

  /**
   * Discover plugins, dynamically import entry modules, and register definitions.
   * Core never statically imports plugin packages (D-10 / D-11).
   */
  async loadDefinitions(): Promise<PluginLoadResult> {
    const result = this.load();
    const loaded: PluginLoadResult['loaded'] = [];
    for (const plugin of result.ordered) {
      const entryPath = join(plugin.rootPath, plugin.manifest.entry);
      if (!existsSync(entryPath)) {
        if (plugin.manifest.required) {
          throw new Error(`Required plugin "${plugin.manifest.id}" entry not found: ${entryPath}`);
        }
        this.logger?.warn(
          `Skipping plugin "${plugin.manifest.id}" — entry missing: ${entryPath}`,
          'PluginLoaderService',
        );
        continue;
      }
      const definition = await importPluginDefinition(entryPath);
      if (definition.id !== plugin.manifest.id) {
        throw new Error(
          `Plugin id mismatch for ${entryPath}: manifest="${plugin.manifest.id}" definition="${definition.id}"`,
        );
      }
      this.registerDefinition(definition);
      loaded.push({ id: definition.id, entryPath });
    }
    return { ...result, loaded };
  }

  getOrderedPlugins(): readonly DiscoveredPlugin[] {
    return this.ordered;
  }

  getState(pluginId: string): PluginLifecycleState | undefined {
    return this.records.get(pluginId)?.state;
  }

  getRecord(pluginId: string): PluginRuntimeRecord | undefined {
    return this.records.get(pluginId);
  }

  listRecords(): readonly PluginRuntimeRecord[] {
    return [...this.records.values()];
  }

  registerDefinition(definition: PluginDefinition): void {
    let record = this.records.get(definition.id);
    if (!record) {
      record = {
        discovered: {
          rootPath: `in-memory://${definition.id}`,
          manifestSource: 'opoha.plugin.json',
          manifest: {
            id: definition.id,
            version: '0.0.0-test',
            contractVersion: PLUGIN_CONTRACT_VERSION,
            entry: 'dist/index.js',
            dependsOn: [],
            required: false,
          },
        },
        state: 'discovered',
        booted: false,
      };
      this.records.set(definition.id, record);
      this.ordered = [...this.ordered, record.discovered];
    }
    record.definition = definition;
  }

  async install(pluginId: string): Promise<PluginLifecycleState> {
    const record = this.requireRecord(pluginId);
    record.state = transitionPluginState(record.state, 'install');
    const ctx = this.contextFor(record, false);
    await record.definition?.install?.(ctx);
    this.logger?.log(`Plugin installed: ${pluginId}`, 'PluginLoaderService');
    return record.state;
  }

  async bootAll(): Promise<void> {
    for (const plugin of this.ordered) {
      await this.boot(plugin.manifest.id);
    }
  }

  async boot(pluginId: string): Promise<void> {
    const record = this.requireRecord(pluginId);
    if (!canBootPlugin(record.state)) {
      return;
    }
    if (record.booted) {
      return;
    }
    const active = record.state === 'enabled';
    const ctx = this.contextFor(record, active);
    await record.definition?.boot?.(ctx);
    record.booted = true;
    this.logger?.log(`Plugin booted: ${pluginId} active=${active}`, 'PluginLoaderService');
  }

  async enable(pluginId: string): Promise<PluginLifecycleState> {
    const record = this.requireRecord(pluginId);
    record.state = transitionPluginState(record.state, 'enable');
    if (!record.booted) {
      await this.boot(pluginId);
    }
    // Activate any contributions registered inactive during install/boot.
    this.contributions.activatePlugin(pluginId);
    this.adminExtensions.setActive(pluginId, true);
    this.paymentProviders.activatePlugin(pluginId);
    this.shippingMethods.activatePlugin(pluginId);
    this.taxProviders.activatePlugin(pluginId);
    this.promotionRules.activatePlugin(pluginId);
    this.notificationProviders.activatePlugin(pluginId);
    this.storageAdapters.activatePlugin(pluginId);
    this.searchProviders.activatePlugin(pluginId);
    this.fxProviders.activatePlugin(pluginId);
    this.scheduledJobs?.activatePlugin(pluginId);
    this.ruleActions?.activatePlugin(pluginId);
    void this.jobsService?.setPluginJobsActive(pluginId, true);
    const ctx = this.contextFor(record, true);
    await record.definition?.enable?.(ctx);
    this.logger?.log(`Plugin enabled: ${pluginId}`, 'PluginLoaderService');
    return record.state;
  }

  async disable(pluginId: string): Promise<PluginLifecycleState> {
    const record = this.requireRecord(pluginId);
    record.state = transitionPluginState(record.state, 'disable');
    this.contributions.deactivatePlugin(pluginId);
    this.adminExtensions.setActive(pluginId, false);
    this.paymentProviders.deactivatePlugin(pluginId);
    this.shippingMethods.deactivatePlugin(pluginId);
    this.taxProviders.deactivatePlugin(pluginId);
    this.promotionRules.deactivatePlugin(pluginId);
    this.notificationProviders.deactivatePlugin(pluginId);
    this.storageAdapters.deactivatePlugin(pluginId);
    this.searchProviders.deactivatePlugin(pluginId);
    this.fxProviders.deactivatePlugin(pluginId);
    this.scheduledJobs?.deactivatePlugin(pluginId);
    this.ruleActions?.deactivatePlugin(pluginId);
    void this.jobsService?.setPluginJobsActive(pluginId, false);
    const ctx = this.contextFor(record, false);
    await record.definition?.disable?.(ctx);
    this.logger?.log(`Plugin disabled: ${pluginId}`, 'PluginLoaderService');
    return record.state;
  }

  async uninstall(pluginId: string): Promise<PluginLifecycleState> {
    const record = this.requireRecord(pluginId);
    record.state = transitionPluginState(record.state, 'uninstall');
    const ctx = this.contextFor(record, false);
    await record.definition?.uninstall?.(ctx);
    this.contributions.removePlugin(pluginId);
    this.adminExtensions.remove(pluginId);
    this.paymentProviders.removePlugin(pluginId);
    this.shippingMethods.removePlugin(pluginId);
    this.taxProviders.removePlugin(pluginId);
    this.promotionRules.removePlugin(pluginId);
    this.notificationProviders.removePlugin(pluginId);
    this.storageAdapters.removePlugin(pluginId);
    this.searchProviders.removePlugin(pluginId);
    this.fxProviders.removePlugin(pluginId);
    void this.jobsService?.removePluginJobs(pluginId);
    this.ruleActions?.removePlugin(pluginId);
    record.booted = false;
    this.logger?.log(`Plugin uninstalled: ${pluginId}`, 'PluginLoaderService');
    return record.state;
  }

  private requireRecord(pluginId: string): PluginRuntimeRecord {
    const record = this.records.get(pluginId);
    if (!record) {
      throw new Error(`Unknown plugin "${pluginId}"`);
    }
    return record;
  }

  private contextFor(record: PluginRuntimeRecord, active: boolean) {
    return createPluginRegistrationContext(
      record.discovered.manifest.id,
      this.contributions,
      this.adminExtensions,
      active,
      {
        payment: this.paymentProviders,
        shipping: this.shippingMethods,
        tax: this.taxProviders,
        promotions: this.promotionRules,
        notifications: this.notificationProviders,
        storage: this.storageAdapters,
        search: this.searchProviders,
        fx: this.fxProviders,
        jobs: this.jobsService,
        scheduledJobs: this.scheduledJobs,
        ruleActions: this.ruleActions,
      },
    );
  }

  private discoverConfigured(): DiscoveredPlugin[] {
    const paths = parsePluginPathsEnv(this.config.get('OPOHA_PLUGINS'));
    const fromList = discoverPlugins(paths);
    const pluginsPath = this.config.get('OPOHA_PLUGINS_PATH')?.trim();
    const fromDir =
      pluginsPath && pluginsPath.length > 0 ? discoverPluginsInDirectory(pluginsPath) : [];

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

/**
 * Dynamically import a plugin entry module. Never statically import plugin packages.
 * Uses a Function-wrapped `import()` so TypeScript/CJS emit does not rewrite to
 * `require()` — official plugins are ESM (`"type": "module"`).
 */
export async function importPluginDefinition(entryPath: string): Promise<PluginDefinition> {
  const href = pathToFileURL(entryPath).href;
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<{
    default?: PluginDefinition;
    plugin?: PluginDefinition;
  }>;
  const mod = await dynamicImport(href);
  const definition = mod.default ?? mod.plugin;
  if (
    !definition ||
    typeof definition !== 'object' ||
    typeof definition.id !== 'string' ||
    definition.id.trim().length === 0
  ) {
    throw new Error(`Plugin entry must default-export a PluginDefinition with id: ${entryPath}`);
  }
  return definition;
}
