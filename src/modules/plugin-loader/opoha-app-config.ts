import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/**
 * Env set by `@opoha/cli` when it runs core scripts with `cwd` at the core
 * package root (common with `file:` / `--link` installs). Points at the
 * consumer app that owns `opoha.config.json`.
 */
export const OPOHA_APP_ROOT_ENV = 'OPOHA_APP_ROOT' as const;

/**
 * App-level `opoha.config.json` shape used for plugin discovery (config-first).
 */
export type OpohaAppConfigFile = {
  name?: string;
  core?: string;
  admin?: string;
  /** Package names, relative/absolute plugin roots, or directories of plugins. */
  plugins?: unknown[];
};

export type FoundOpohaAppConfig = {
  root: string;
  configPath: string;
  config: OpohaAppConfigFile;
};

/**
 * Directory to start config/env discovery from.
 * Prefer `OPOHA_APP_ROOT` (CLI) over `process.cwd()` so linked `file:` cores
 * that nest with cwd=`opoha-core` still load the app's `opoha.config.json`.
 */
export function resolveAppConfigStartDir(
  fallbackDir: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fromEnv = env[OPOHA_APP_ROOT_ENV]?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return resolve(fromEnv);
  }
  return resolve(fallbackDir);
}

/**
 * Walk parents from `startDir` looking for `opoha.config.json`.
 */
export function findOpohaAppConfig(startDir: string): FoundOpohaAppConfig | null {
  let current = resolve(startDir);
  for (;;) {
    const configPath = join(current, 'opoha.config.json');
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf8')) as OpohaAppConfigFile;
        return { root: current, configPath, config };
      } catch {
        return null;
      }
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

/**
 * Normalize `plugins` field to string specs (package names or paths).
 */
export function parsePluginsField(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      out.push(entry.trim());
    } else if (
      entry &&
      typeof entry === 'object' &&
      typeof (entry as { path?: unknown }).path === 'string' &&
      ((entry as { path: string }).path.trim().length > 0)
    ) {
      out.push((entry as { path: string }).path.trim());
    } else if (
      entry &&
      typeof entry === 'object' &&
      typeof (entry as { package?: unknown }).package === 'string' &&
      ((entry as { package: string }).package.trim().length > 0)
    ) {
      out.push((entry as { package: string }).package.trim());
    }
  }
  return out;
}

/**
 * Resolve a plugin specifier to a filesystem directory.
 * Accepts absolute/relative paths or npm package names (resolved from `fromDir`).
 */
export function resolvePluginSpecifier(spec: string, fromDir: string): string {
  const trimmed = spec.trim();
  if (trimmed.length === 0) {
    throw new Error('Empty plugin specifier');
  }

  if (isAbsolute(trimmed)) {
    if (!existsSync(trimmed)) {
      throw new Error(`Plugin path does not exist: ${trimmed}`);
    }
    return trimmed;
  }

  const looksLikePath =
    trimmed.startsWith('.') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('node_modules/') ||
    (!trimmed.startsWith('@') && (trimmed.includes('/') || trimmed.includes('\\')));

  if (looksLikePath) {
    const resolved = resolve(fromDir, trimmed);
    if (!existsSync(resolved)) {
      throw new Error(`Plugin path does not exist: ${resolved} (from ${spec})`);
    }
    return resolved;
  }

  // Package name (e.g. @opoha/plugin-manual-payment or unscoped-name)
  const fromNodeModules = resolvePackageRoot(trimmed, fromDir);
  if (fromNodeModules) {
    return fromNodeModules;
  }
  throw new Error(
    `Cannot resolve plugin package "${trimmed}" from ${fromDir}. ` +
      `Install it (e.g. pnpm add ${trimmed}) or use a filesystem path in opoha.config.json.`,
  );
}

function resolvePackageRoot(packageName: string, fromDir: string): string | null {
  try {
    const requireFrom = createRequire(join(fromDir, 'package.json'));
    const pkgJson = requireFrom.resolve(`${packageName}/package.json`);
    return dirname(pkgJson);
  } catch {
    // fall through to manual walk
  }

  let current = fromDir;
  for (;;) {
    const candidate = join(current, 'node_modules', ...packageName.split('/'));
    if (existsSync(join(candidate, 'package.json'))) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

/**
 * Whether a directory looks like a single plugin root (manifest present).
 */
export function isPluginRootDirectory(dir: string): boolean {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return false;
  }
  if (existsSync(join(dir, 'opoha.plugin.json'))) {
    return true;
  }
  const packagePath = join(dir, 'package.json');
  if (!existsSync(packagePath)) {
    return false;
  }
  try {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as { opoha?: unknown };
    return pkg.opoha !== undefined;
  } catch {
    return false;
  }
}
