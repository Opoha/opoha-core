import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

import { findOpohaAppConfig } from '../modules/plugin-loader/opoha-app-config';

const DOTENV_QUIET = { quiet: true } as const;

/**
 * Load env files only from the consumer app root (nearest `opoha.config.json`)
 * or, when no config is found, from `startDir` itself — never walk into home
 * or unrelated parents via bare `dotenv.config()`.
 *
 * Order: `.env` then `.env.local` (later does not override already-set keys).
 * Does not override variables already set in `process.env` (e.g. by the CLI).
 */
export function loadAppEnv(startDir: string = process.cwd()): void {
  const app = findOpohaAppConfig(startDir);
  const root = app?.root ?? resolve(startDir);

  for (const name of ['.env', '.env.local'] as const) {
    const envPath = join(root, name);
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath, ...DOTENV_QUIET });
    }
  }
}
