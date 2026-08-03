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
pnpm exec prisma migrate deploy --schema=database/prisma
pnpm dev                # NestJS + GraphQL on :4000
```

| Endpoint | Purpose |
|----------|---------|
| `GET /health/live` | Liveness |
| `GET /health/ready` | Readiness (stub until B-04) |
| `POST/GET /graphql` | GraphQL (Apollo playground in dev) |

## Config (B-02)

- `.env` loaded via `dotenv` + Zod (`src/modules/config/env.schema.ts`)
- Typed `ConfigService` is global; invalid env fails boot
- Documented keys: `PORT`, `DATABASE_URL`, `REDIS_URL`, `LOG_LEVEL`, `OTEL_ENABLED`

## Logging (B-03)

- Structured JSON logs via `AppLogger`
- `CorrelationIdMiddleware` sets/propagates `x-request-id` and `x-correlation-id` (UUID if missing)

## Prisma (B-01)

Multi-file schema under `database/prisma/` (auth fragment owned by auth module). Spike writeup:

- Workspace: `opoha-workspace/docs/research/2026-08-03-prisma-ownership-spike.md`
- Local mirror: `database/spikes/prisma-ownership-spike.md`

```bash
pnpm prisma:generate
pnpm prisma:migrate          # migrate dev (new migrations)
pnpm exec prisma migrate deploy --schema=database/prisma
```

## Scripts

```bash
pnpm build
pnpm start
pnpm test
pnpm lint
pnpm docker:down
```

## Related

- ADR-0001 Modular Monolith
- ADR-0002 NestJS + GraphQL + Prisma
- ADR-0009 Multi-Repository Ecosystem
