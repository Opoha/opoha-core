/**
 * Public plugin-loader surface for other core modules.
 */
export { PluginLoaderModule } from '../plugin-loader.module';
export { PluginLoaderService } from '../plugin-loader.service';
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
  parsePluginPathsEnv,
} from '../plugin-discovery';
