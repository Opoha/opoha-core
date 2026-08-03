import type { DiscoveredPlugin } from './plugin-manifest';

/**
 * Topologically sort plugins by `dependsOn`.
 * Throws on unknown dependency ids or cycles.
 */
export function orderPluginsByDependency(
  plugins: DiscoveredPlugin[],
): DiscoveredPlugin[] {
  const byId = new Map<string, DiscoveredPlugin>();
  for (const plugin of plugins) {
    if (byId.has(plugin.manifest.id)) {
      throw new Error(`Duplicate plugin id "${plugin.manifest.id}"`);
    }
    byId.set(plugin.manifest.id, plugin);
  }

  for (const plugin of plugins) {
    for (const dep of plugin.manifest.dependsOn) {
      if (!byId.has(dep)) {
        throw new Error(
          `Plugin "${plugin.manifest.id}" depends on missing plugin "${dep}"`,
        );
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: DiscoveredPlugin[] = [];

  function visit(id: string): void {
    if (visited.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      throw new Error(`Circular plugin dependency involving "${id}"`);
    }
    visiting.add(id);
    const plugin = byId.get(id);
    if (!plugin) {
      throw new Error(`Unknown plugin id "${id}"`);
    }
    for (const dep of plugin.manifest.dependsOn) {
      visit(dep);
    }
    visiting.delete(id);
    visited.add(id);
    ordered.push(plugin);
  }

  for (const plugin of plugins) {
    visit(plugin.manifest.id);
  }

  return ordered;
}
