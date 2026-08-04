import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

import {
  findOpohaAppConfig,
  resolveAppConfigStartDir,
} from '../modules/plugin-loader/opoha-app-config';

const DOTENV_QUIET = { quiet: true } as const;

/**
 * Load env files only from the consumer app root (nearest `opoha.config.json`)
 * or, when no config is found, from `startDir` itself — never walk into home
 * or unrelated parents via bare `dotenv.config()`.
 *
 * Order: `.env` then `.env.local` (later does not override already-set keys).
 * Does not override variables already set in `process.env` (e.g. by the CLI).
 * Honors `OPOHA_APP_ROOT` when set (linked `file:` core / `opoha dev`).
 */
export function loadAppEnv(startDir?: string): void {
  const resolvedStart = resolveAppConfigStartDir(startDir ?? process.cwd());
  const app = findOpohaAppConfig(resolvedStart);
  const root = app?.root ?? resolve(resolvedStart);

  for (const name of ['.env', '.env.local'] as const) {
    const envPath = join(root, name);
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath, ...DOTENV_QUIET });
    }
  }
}
