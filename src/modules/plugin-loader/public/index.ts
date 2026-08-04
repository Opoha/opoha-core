/**
 * Public plugin-loader surface for other core modules.
 */
export { PluginLoaderModule } from '../plugin-loader.module';
export { PluginLoaderService } from '../plugin-loader.service';
export type { PluginRuntimeRecord, PluginLoadResult } from '../plugin-loader.service';
export { ContributionRegistry } from '../contribution-registry';
export type {
  GraphQLContribution,
  ProviderContribution,
  ListenerContribution,
} from '../contribution-registry';
export { AdminExtensionRegistry, adminContributionSchema } from '../admin-extension-registry';
export type { AdminContribution, AdminExtensionManifest } from '../admin-extension-registry';
export {
  PLUGIN_CONTRACT_VERSION,
  parsePluginManifest,
  pluginManifestSchema,
} from '../plugin-manifest';
export type { DiscoveredPlugin, PluginManifest } from '../plugin-manifest';
export { orderPluginsByDependency } from '../dependency-order';
export {
  discoverPluginAt,
  discoverPlugins,
  discoverPluginsFromAppConfig,
  discoverPluginsFromSpecs,
  discoverPluginsInDirectory,
  parsePluginPathsEnv,
} from '../plugin-discovery';
export {
  findOpohaAppConfig,
  OPOHA_APP_ROOT_ENV,
  parsePluginsField,
  resolveAppConfigStartDir,
  resolvePluginSpecifier,
  isPluginRootDirectory,
} from '../opoha-app-config';
export type { OpohaAppConfigFile, FoundOpohaAppConfig } from '../opoha-app-config';
export { transitionPluginState, canBootPlugin, PLUGIN_LIFECYCLE_STATES } from '../plugin-lifecycle';
export type { PluginLifecycleState, PluginLifecycleAction } from '../plugin-lifecycle';
export type { PluginDefinition, PluginRegistrationContext } from '../plugin-definition';
export { createPluginRegistrationContext } from '../plugin-definition';
