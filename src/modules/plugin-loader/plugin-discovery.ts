import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import {
  type DiscoveredPlugin,
  parsePluginManifest,
} from './plugin-manifest';

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

  throw new Error(
    `No opoha.plugin.json or package.json found under ${resolved}`,
  );
}

/**
 * Discover plugins from configured path list, then return dependency order.
 */
export function discoverPlugins(paths: string[]): DiscoveredPlugin[] {
  const discovered = paths
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => discoverPluginAt(p));
  return discovered;
}

/**
 * Parse `OPOHA_PLUGINS` env: comma-separated paths or JSON string array.
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
