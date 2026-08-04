# Opoha Core

Commerce engine / runtime — the modular monolith at the center of Opoha.

## Purpose

Host NestJS application modules, GraphQL (code-first), TypeORM host, event bus, and plugin loader. This is the only package that owns the commerce runtime.

## Boundaries

- **MUST NOT** depend on `@opoha/plugin-*` or provider SDKs (Stripe, DHL, etc.)
- Plugins register via `@opoha/plugin-sdk` + public core APIs — never by editing this repo
- Admin and SDK talk to core **only** through GraphQL
- Shared tooling comes from `opoha-toolkit` as **devDependencies** only

## Package

- npm: `@opoha/core`
- Stack (ADR-0002): NestJS · Apollo GraphQL · TypeORM · Redis · Vitest

## Quick start

```bash
pnpm install
pnpm docker:up          # Postgres 16 + Redis 7 (host :5433 / :6380)
cp .env.example .env
pnpm db:migrate         # TypeORM migration:run
pnpm db:seed            # admin role + permissions (+ optional admin user)
pnpm dev                # NestJS + GraphQL on :4000
```

| Endpoint            | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `GET /health/live`  | Liveness                                       |
| `GET /health/ready` | Readiness — pings Postgres + Redis (200 / 503) |
| `POST/GET /graphql` | GraphQL (Apollo playground in dev)             |

## Config (B-02)

- `.env` loaded via `dotenv` + Zod (`src/modules/config/env.schema.ts`)
- Typed `ConfigService` is global; invalid env fails boot
- Documented keys: `PORT`, `DATABASE_URL`, `REDIS_URL`, `LOG_LEVEL`, `OTEL_ENABLED`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `OPOHA_PLUGINS`, `OPOHA_PLUGINS_PATH`

## Auth (C-01 … C-09)

Staff JWT auth + RBAC + API keys + append-only audit (customers deferred).

| Env              | Notes                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------- |
| `JWT_SECRET`     | **Required in production** (fail-fast). Dev/test use an insecure fallback when unset. |
| `JWT_EXPIRES_IN` | Default `1h` (jsonwebtoken duration string)                                           |

Password hashes are never exposed in GraphQL types. Seeded `admin` role + permissions from B-07 remain the baseline (`user:*`, `role:*`, `permission:read`, `api-key:*`, `audit:read`).

### GraphQL surface

| Op  | Name                                       | Auth             | Permission                                    |
| --- | ------------------------------------------ | ---------------- | --------------------------------------------- |
| Q   | `ping`                                     | public           | —                                             |
| M   | `login`                                    | public           | —                                             |
| M   | `refresh`                                  | public           | —                                             |
| M   | `logout`                                   | public           | —                                             |
| Q   | `me`                                       | Bearer / API key | —                                             |
| Q   | `users` / `user`                           | Bearer / API key | `user:read`                                   |
| M   | `createUser` / `updateUser` / `deleteUser` | Bearer / API key | `user:create` / `user:update` / `user:delete` |
| Q   | `roles` / `role`                           | Bearer / API key | `role:read`                                   |
| M   | `assignRole` / `removeRole`                | Bearer / API key | `role:update`                                 |
| Q   | `permissions` / `permission`               | Bearer / API key | `permission:read`                             |
| Q   | `apiKeys`                                  | Bearer / API key | `api-key:read`                                |
| M   | `createApiKey` / `revokeApiKey`            | Bearer / API key | `api-key:create` / `api-key:revoke`           |
| Q   | `auditLogs`                                | Bearer / API key | `audit:read`                                  |

Machine auth: send `X-API-Key: <secret>` (takes precedence over Bearer when present). API key create/revoke and auth/user/role mutations append to `audit_logs`.

```graphql
mutation Login {
  login(email: "admin@example.com", password: "change-me-in-local-dev") {
    accessToken
    refreshToken
    user {
      id
      email
      isActive
    }
  }
}

query Me {
  me {
    id
    email
    isActive
  }
}

mutation CreateUser {
  createUser(input: { email: "staff@example.com", password: "temporary-pass" }) {
    id
    email
  }
}

query AuditLogs {
  auditLogs(limit: 20) {
    id
    action
    actorUserId
    resourceType
    resourceId
    metadataJson
    createdAt
  }
}
```

Send `Authorization: Bearer <accessToken>` on protected operations.

## Event bus (D-01 / D-02)

In-process NestJS `EventBusService` (`EventBusModule` is global):

- `publish` / `subscribe` with per-listener error isolation (default)
- Zod payload schemas registered per event name before publish
- Envelope: `eventId`, `eventName`, `occurredAt`, `aggregateType`, `aggregateId`, `payloadVersion`, `data`, optional `metadata.correlationId` / `actorId`

Auth catalog (emitted from auth flows): `UserRegistered`, `UserUpdated`, `UserDeleted`, `LoginSucceeded`, `LoginFailed`, `ApiKeyCreated`, `ApiKeyRevoked`.

## Plugin loader (D-03)

Discovery + manifest parse + dependency order (lifecycle install/boot is D-04).

| Env                  | Purpose                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `OPOHA_PLUGINS`      | Comma-separated plugin root paths, or a JSON string array                                          |
| `OPOHA_PLUGINS_PATH` | Parent directory; each child folder with `opoha.plugin.json` or `package.json#opoha` is discovered |

Manifest fields: `id`, `version`, `contractVersion` (`0.1`), `entry` (default `dist/index.js`), `dependsOn`, optional engines/display metadata.

```bash
# Explicit package roots
OPOHA_PLUGINS=../plugin-storage-localfs,../plugin-manual-payment

# Or scan a plugins directory
OPOHA_PLUGINS_PATH=/path/to/plugins
```

`PluginLoaderService.load()` validates manifests and topological order without executing plugin entry modules. Cycles and missing dependencies fail with a clear error.

## Logging (B-03)

- Structured JSON logs via `AppLogger`
- `CorrelationIdMiddleware` sets/propagates `x-request-id` and `x-correlation-id` (UUID if missing)

## Health / readiness (B-04)

- `GET /health/live` — process up
- `GET /health/ready` — `SELECT 1` via TypeORM + Redis `PING`
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

## TypeORM (B-01 / ADR-0010)

Auth-owned entities under `src/modules/auth/entities/`; CLI DataSource at `database/data-source.ts`. Spike writeup:

- Workspace: `opoha-workspace/docs/research/2026-08-03-typeorm-ownership-spike.md`
- Local mirror: `database/spikes/typeorm-ownership-spike.md`

```bash
pnpm db:migrate              # typeorm migration:run
pnpm db:seed
```

If you previously applied Prisma migrations locally, reset the DB volume first (`pnpm docker:down` with `-v`, then `docker:up`).

### Seed (B-07)

`pnpm db:seed` upserts:

- Role `admin`
- Baseline permissions (`user:*`, `role:*`, `permission:read`, `api-key:*`, `audit:read`, catalog/inventory/customer/cart/order/localization keys)
- Role↔permission links
- Singleton localization settings (`US` / `USD` / `UTC` / `en-US`) when missing — does **not** overwrite operator changes

Optional admin **user** (idempotent): set both in `.env` (see `.env.example` comments):

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

If either is missing, seed skips the user and only applies roles/permissions. Password hashing uses Node `scrypt` for seed-time only (Phase C may replace with argon2/bcrypt).

CLI stubs (from a project checkout): `opoha migrate` / `opoha seed` → see `@opoha/cli`.

## Localization (Phase 1 E)

Single-country deployment foundation — **not** multi-store / multi-currency / multi-language (those land in Phase 5).

| Field           | Meaning                                  | Default |
| --------------- | ---------------------------------------- | ------- |
| `countryCode`   | ISO 3166-1 alpha-2                       | `US`    |
| `currencyCode`  | ISO 4217 (integer minor units elsewhere) | `USD`   |
| `timezone`      | IANA zone                                | `UTC`   |
| `defaultLocale` | BCP 47 language foundation               | `en-US` |

| Op  | Name                         | Permission            |
| --- | ---------------------------- | --------------------- |
| Q   | `localizationSettings`       | `localization:read`   |
| M   | `updateLocalizationSettings` | `localization:update` |

Table `localization_settings` is a singleton (`key = 'default'`). Full i18n string catalogs and FX rates remain out of scope until Phase 5.

## Store channel settings (Phase 5 B-03)

Per-store channel configuration owned by the configuration module (`store_channel_settings`).

| Field          | Meaning                                   | Default  |
| -------------- | ----------------------------------------- | -------- |
| `timezone`     | IANA zone                                 | `UTC`    |
| `countryCode`  | ISO 3166-1 alpha-2                        | `US`     |
| `catalogMode`  | `shared` \| `isolated` catalog preference | `shared` |
| `settingsJson` | Extensible opaque JSON bag                | `{}`     |

| Op  | Name                            | Permission        |
| --- | ------------------------------- | ----------------- |
| Q   | `storeChannelSettings(storeId)` | `settings:read`   |
| Q   | `storeChannelSettingsList`      | `settings:read`   |
| M   | `updateStoreChannelSettings`    | `settings:update` |

Defaults are created on first read and when a store is created (`StoreCreated` listener).

## Store currency config (Phase 5 D-01)

Per-store display vs settlement currency owned by the currency module (`store_currency_config`).

| Field                      | Meaning                                | Default                               |
| -------------------------- | -------------------------------------- | ------------------------------------- |
| `settlementCurrencyCode`   | ISO 4217 capture / settlement currency | store `defaultCurrencyCode`           |
| `displayCurrencyCode`      | Primary customer-facing ISO 4217       | same as settlement                    |
| `enabledDisplayCurrencies` | Additional allowed display currencies  | `[display]` (primary always included) |

| Op  | Name                           | Permission        |
| --- | ------------------------------ | ----------------- |
| Q   | `storeCurrencyConfig(storeId)` | `currency:read`   |
| Q   | `storeCurrencyConfigList`      | `currency:read`   |
| M   | `updateStoreCurrencyConfig`    | `currency:update` |

Defaults are created on first read and when a store is created (`StoreCreated` listener). Cart/checkout display conversion: see D-03 below.

## Exchange rates (Phase 5 D-02)

Global FX table `exchange_rates` (currency module). Rate semantics: **1 `fromCurrencyCode` = `rate` × `toCurrencyCode`**. Unique on `(from, to)`. Manual CRUD uses `source: manual`; FX plugins (D-04) may write other sources via core APIs.

| Op  | Name                                                | Permission        |
| --- | --------------------------------------------------- | ----------------- |
| Q   | `exchangeRates(fromCurrencyCode?, toCurrencyCode?)` | `currency:read`   |
| Q   | `exchangeRate(id)`                                  | `currency:read`   |
| M   | `createExchangeRate`                                | `currency:update` |
| M   | `updateExchangeRate`                                | `currency:update` |
| M   | `upsertExchangeRate`                                | `currency:update` |
| M   | `deleteExchangeRate`                                | `currency:update` |

Mutations publish `ExchangeRateUpdated` (delete sets `rate: null`, `deleted: true`). Same-currency `getRate` returns `1` without a row.

## Cart / checkout display conversion (Phase 5 D-03)

Settlement amounts stay on `cart.currencyCode` / `CheckoutTotals` (payment capture). Display conversion uses store-enabled currencies + `exchange_rates`.

| Op  | Name                                              | Notes                                                                                      |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Q   | `cartDisplayTotals(cartId, displayCurrencyCode?)` | Converts cart line/shipping/tax/discount snapshot; defaults to store `displayCurrencyCode` |
| M   | `prepareCheckout(cartId, displayCurrencyCode?)`   | Returns `totals` (settlement) + `displayTotals` (converted)                                |

### Rounding

- Rate semantics: **1 settlement = `rate` × display** (major units). Opoha stores money as **2-decimal minor units** for all currencies (same as `formatMinorAmount`), so the rate multiplies minor amounts directly.
- Final minor units: **`half_up`** (`Math.round` on non-negative intermediates) to the nearest integer minor unit.
- Same-currency display: identity, `rate: 1`, no drift.
- Missing cross-currency rate → `BadRequest` asking to configure a manual rate before using that display currency.

`createCart` defaults `currencyCode` to the store’s `settlementCurrencyCode` when omitted.

## Multi-store catalog filters (Phase 5 B-04)

| Op  | Args                                 | Behavior                                                            |
| --- | ------------------------------------ | ------------------------------------------------------------------- |
| Q   | `products(storeId?, catalogMode?)`   | Store-scoped list; `shared` = shared∪owned, `isolated` = owned-only |
| Q   | `categories(storeId?, catalogMode?)` | Same scoping rules as products                                      |

Omit `catalogMode` to use the store’s channel setting. Omit `storeId` for admin/global listing.

## Walking skeleton (H-01 / G-02)

Automated spine check including Commerce Core catalog → order smoke:

```bash
pnpm walking-skeleton
# or: SKIP_DOCKER=1 pnpm walking-skeleton   # when Postgres/Redis already up
# SKIP_COMMERCE=1 to run MVP auth/plugin/doctor path only
```

Steps: `docker compose up` → migrate → seed → boot → `/health/*` → GraphQL `login` + `me` → createProduct → createInventoryItem → cart → prepareCheckout → placeOrder → (local multi-repo) `opoha plugin install` + `opoha doctor`.

CI: `.github/workflows/walking-skeleton.yml` checks out sibling `opoha-cli`, `opoha-plugin-sdk`, and `plugin-manual-payment`, builds them, then runs the skeleton **with doctor + plugin install** (H-04) and commerce smoke (G-02). Boundary job: `pnpm test:boundary` (H-02).

Full multi-repo path (create-opoha + admin UI) is described in the workspace design doc; this package owns the runtime gate.

## Scripts

```bash
pnpm build
pnpm start
pnpm test
pnpm test:boundary      # H-02 / G-03 core → plugin / provider SDK audit
pnpm walking-skeleton   # H-01 + G-02 commerce smoke
pnpm lint
pnpm db:migrate
pnpm db:seed
pnpm docker:down
```

## Related

- ADR-0001 Modular Monolith
- ADR-0002 NestJS + GraphQL + TypeORM
- ADR-0010 TypeORM Persistence
- ADR-0009 Multi-Repository Ecosystem
