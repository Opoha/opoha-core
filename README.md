# Opoha Core

Commerce engine / runtime — the modular monolith at the center of Opoha.

## Purpose

Host NestJS application modules, GraphQL (code-first), Prisma composition host, event bus, and plugin loader. This is the only package that owns the commerce runtime.

## Boundaries

- **MUST NOT** depend on `@opoha/plugin-*` or provider SDKs (Stripe, DHL, etc.)
- Plugins register via `@opoha/plugin-sdk` + public core APIs — never by editing this repo
- Admin and SDK talk to core **only** through GraphQL
- Shared tooling comes from `opoha-toolkit` as **devDependencies** only

## Package

- npm: `@opoha/core`
- Stack (ADR-0002): NestJS · Apollo GraphQL · Prisma · Redis · Vitest

## Quick start

```bash
pnpm install
pnpm docker:up          # Postgres 16 + Redis 7 (host :5433 / :6380)
cp .env.example .env
pnpm prisma:generate
pnpm db:migrate         # apply migrations (deploy)
pnpm db:seed            # admin role + permissions (+ optional admin user)
pnpm dev                # NestJS + GraphQL on :4000
```

| Endpoint | Purpose |
|----------|---------|
| `GET /health/live` | Liveness |
| `GET /health/ready` | Readiness — pings Postgres + Redis (200 / 503) |
| `POST/GET /graphql` | GraphQL (Apollo playground in dev) |

## Config (B-02)

- `.env` loaded via `dotenv` + Zod (`src/modules/config/env.schema.ts`)
- Typed `ConfigService` is global; invalid env fails boot
- Documented keys: `PORT`, `DATABASE_URL`, `REDIS_URL`, `LOG_LEVEL`, `OTEL_ENABLED`

## Logging (B-03)

- Structured JSON logs via `AppLogger`
- `CorrelationIdMiddleware` sets/propagates `x-request-id` and `x-correlation-id` (UUID if missing)

## Health / readiness (B-04)

- `GET /health/live` — process up
- `GET /health/ready` — `SELECT 1` via Prisma + Redis `PING`
  - **200** `{ "status": "ok", "checks": { "postgres": "ok", "redis": "ok" } }`
  - **503** when either check fails (JSON body includes per-check status)

## OpenTelemetry (B-05)

- Off by default (`OTEL_ENABLED=false`)
- When `OTEL_ENABLED=true`, registers a `BasicTracerProvider` with console span exporter
- Public hook: `import { getTracer } from '@opoha/core'` (no-op tracer when disabled)

## API versioning (B-06)

- Header: **`X-API-Version`**
- Default when omitted: **`1`**
- Also accepted: **`2026-08-03`** (MVP freeze-date alias → canonical `1`)
- Unsupported values → **400** with a clear JSON error
- Design note: `opoha-workspace/docs/architecture/api-versioning.md`

```bash
curl -H 'X-API-Version: 1' http://localhost:4000/graphql
```

## Prisma (B-01)

Multi-file schema under `database/prisma/` (auth fragment owned by auth module). Spike writeup:

- Workspace: `opoha-workspace/docs/research/2026-08-03-prisma-ownership-spike.md`
- Local mirror: `database/spikes/prisma-ownership-spike.md`

```bash
pnpm prisma:generate
pnpm prisma:migrate          # migrate dev (new migrations / local iteration)
pnpm db:migrate              # migrate deploy (apply existing migrations)
pnpm db:seed                 # or: pnpm prisma:seed
```

### Seed (B-07)

`pnpm db:seed` upserts:

- Role `admin`
- Baseline permissions (`user:*`, `role:*`, `permission:read`, `api-key:*`, `audit:read`)
- Role↔permission links

Optional admin **user** (idempotent): set both in `.env` (see `.env.example` comments):

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

If either is missing, seed skips the user and only applies roles/permissions. Password hashing uses Node `scrypt` for seed-time only (Phase C may replace with argon2/bcrypt).

CLI stubs (from a project checkout): `opoha migrate` / `opoha seed` → see `@opoha/cli`.

## Scripts

```bash
pnpm build
pnpm start
pnpm test
pnpm lint
pnpm db:migrate
pnpm db:seed
pnpm docker:down
```

## Related

- ADR-0001 Modular Monolith
- ADR-0002 NestJS + GraphQL + Prisma
- ADR-0009 Multi-Repository Ecosystem
