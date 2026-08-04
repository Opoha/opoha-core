import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import {
  findOpohaAppConfig,
  isPluginRootDirectory,
  parsePluginsField,
  resolvePluginSpecifier,
} from './opoha-app-config';
import { type DiscoveredPlugin, parsePluginManifest } from './plugin-manifest';

function readJsonFile(path: string): unknown {
  const text = readFileSync(path, 'utf8');
  return JSON.parse(text) as unknown;
}

/**
 * Discover a single plugin root (directory or package path).
 * Prefers `opoha.plugin.json`, else `package.json` → `opoha` key.
 */
export function discoverPluginAt(rootPath: string): DiscoveredPlugin {
  const resolved = isAbsolute(rootPath) ? rootPath : resolve(rootPath);
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
    throw new Error(`Plugin path is not a directory: ${resolved}`);
  }

  const manifestPath = join(resolved, 'opoha.plugin.json');
  if (existsSync(manifestPath)) {
    const raw = readJsonFile(manifestPath);
    return {
      rootPath: resolved,
      manifestSource: 'opoha.plugin.json',
      manifest: parsePluginManifest(raw),
    };
  }

  const packagePath = join(resolved, 'package.json');
  if (existsSync(packagePath)) {
    const pkg = readJsonFile(packagePath) as { opoha?: unknown };
    if (pkg.opoha === undefined) {
      throw new Error(
        `package.json at ${resolved} is missing required "opoha" plugin manifest key`,
      );
    }
    return {
      rootPath: resolved,
      manifestSource: 'package.json',
      manifest: parsePluginManifest(pkg.opoha),
    };
  }

  throw new Error(`No opoha.plugin.json or package.json found under ${resolved}`);
}

/**
 * Discover plugins from an explicit path list (each entry is a plugin root).
 */
export function discoverPlugins(paths: string[]): DiscoveredPlugin[] {
  return paths
.map((p) => p.trim())
.filter((p) => p.length > 0)
.map((p) => discoverPluginAt(p));
}

/**
 * Scan a directory for immediate child folders that look like plugins.
 * Skips entries that are not directories or lack a recognizable manifest.
 */
export function discoverPluginsInDirectory(directoryPath: string): DiscoveredPlugin[] {
  const resolved = isAbsolute(directoryPath) ? directoryPath : resolve(directoryPath);
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
    throw new Error(`OPOHA_PLUGINS_PATH is not a directory: ${resolved}`);
  }

  const discovered: DiscoveredPlugin[] = [];
  for (const name of readdirSync(resolved)) {
    const child = join(resolved, name);
    if (!statSync(child).isDirectory()) {
      continue;
    }
    const hasManifest =
      existsSync(join(child, 'opoha.plugin.json')) || existsSync(join(child, 'package.json'));
    if (!hasManifest) {
      continue;
    }
    try {
      discovered.push(discoverPluginAt(child));
    } catch {
      // Skip non-plugin children (e.g. package.json without opoha key).
    }
  }
  return discovered;
}

/**
 * Parse `OPOHA_PLUGINS` env: comma-separated paths or JSON string array.
 * Secondary to `opoha.config.json` — use for CI / advanced overrides.
 */
export function parsePluginPathsEnv(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === '') {
    return [];
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((p) => typeof p === 'string')) {
      throw new Error('OPOHA_PLUGINS JSON must be an array of strings');
    }
    return parsed;
  }
  return trimmed
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Discover plugins listed in `opoha.config.json` (package names, roots, or directories).
 * Walks up from `startDir` to find the config file.
 */
export function discoverPluginsFromAppConfig(startDir: string): DiscoveredPlugin[] {
  const found = findOpohaAppConfig(startDir);
  if (!found) {
    return [];
  }
  const specs = parsePluginsField(found.config.plugins);
  return discoverPluginsFromSpecs(specs, found.root);
}

/**
 * Resolve plugin specs relative to `fromDir` into discovered plugins.
 * A spec may be a single plugin root or a directory of plugin children.
 */
export function discoverPluginsFromSpecs(
  specs: string[],
  fromDir: string,
): DiscoveredPlugin[] {
  const discovered: DiscoveredPlugin[] = [];
  for (const spec of specs) {
    const resolved = resolvePluginSpecifier(spec, fromDir);
    if (isPluginRootDirectory(resolved)) {
      discovered.push(discoverPluginAt(resolved));
      continue;
    }
    if (statSync(resolved).isDirectory()) {
      discovered.push(...discoverPluginsInDirectory(resolved));
      continue;
    }
    throw new Error(`Plugin specifier is not a plugin root or directory: ${spec} → ${resolved}`);
  }
  return discovered;
}
