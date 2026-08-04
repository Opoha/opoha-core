import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { config as loadDotenv } from 'dotenv';

import { findOpohaAppConfig } from '../modules/plugin-loader/opoha-app-config';

/**
 * Load `.env` from the consumer app root (nearest `opoha.config.json`) then cwd.
 * Does not override variables already set in `process.env` (e.g. by the CLI).
 */
export function loadAppEnv(startDir: string = process.cwd()): void {
  const app = findOpohaAppConfig(startDir);
  if (app) {
    const envPath = join(app.root, '.env');
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath });
    }
  }
  loadDotenv();
}
