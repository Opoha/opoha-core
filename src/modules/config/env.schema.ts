import { z } from 'zod';

import { loadAppEnv } from '../../database/load-app-env';

/** Dev/test-only default — production must set JWT_SECRET explicitly. */
export const DEV_JWT_SECRET_FALLBACK = 'dev-only-insecure-jwt-secret-change-me';

export const envSchema = z
.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1).default('postgresql://opoha:opoha@localhost:5433/opoha'),
    REDIS_URL: z.string().min(1).default('redis://localhost:6380'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug']).default('info'),
    OTEL_ENABLED: z
.string()
.optional()
.transform((value) => ['1', 'true', 'yes', 'on'].includes((value ?? '').toLowerCase())),
    /** HS256 signing secret. Required in production; optional elsewhere (dev fallback). */
    JWT_SECRET: z.string().min(1).optional(),
    /** jose/jsonwebtoken duration string, e.g. `15m`, `1h`. */
    JWT_EXPIRES_IN: z.string().min(1).default('1h'),
    /** Opaque refresh-token lifetime, e.g. `7d`. */
    JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('7d'),
    /**
     * Optional override of plugin roots — comma-separated paths or a JSON string array.
     * Prefer `opoha.config.json` `"plugins"` for day-to-day management; use env for CI/advanced.
     */
    OPOHA_PLUGINS: z.string().optional().default(''),
    /**
     * Optional directory whose immediate child folders are scanned for plugin manifests
     * (`opoha.plugin.json` or `package.json#opoha`). Secondary to config; overrides same ids.
     */
    OPOHA_PLUGINS_PATH: z.string().optional().default(''),
    /**
 * Job queue backend: `memory` (unit / default) or `bullmq` (Redis; wiring).
     * See docs/readiness/jobs-cron-contracts.md
     */
    OPOHA_JOB_QUEUE: z.enum(['memory', 'bullmq']).optional().default('memory'),
  })
.superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && !data.JWT_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET is required when NODE_ENV=production',
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema> & {
  /** Resolved secret — never empty after loadEnv. */
  JWT_SECRET: string;
};

/**
 * Load and Zod-validate process env. Fail-fast on invalid values.
 * When `source` is omitted, loads app-root `.env` / `.env.local` then reads `process.env`.
 */
export function loadEnv(source?: NodeJS.ProcessEnv): AppEnv {
  if (source === undefined) {
    loadAppEnv();
  }
  const parsed = envSchema.safeParse(source ?? process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
.join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  const data = parsed.data;
  return {
...data,
    JWT_SECRET: data.JWT_SECRET ?? DEV_JWT_SECRET_FALLBACK,
  };
}
