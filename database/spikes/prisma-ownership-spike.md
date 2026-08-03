# Prisma Ownership Spike (B-01)

**Date:** 2026-08-03  
**Repo:** `opoha-core`  
**ADR:** [ADR-0005](../../../opoha-workspace/docs/adr/ADR-0005-prisma-schema-ownership.md)  
**Design:** [database-module-ownership-design.md](../../../opoha-workspace/docs/design/database-module-ownership-design.md)

## Goal

Prove a composition approach for module-owned Prisma models before Phase C auth implementation and plugin migrations.

## Options evaluated

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| 1. Prisma **multi-file schema** (native folder) | Official; `prisma generate` / migrate work; low custom tooling | Module files currently co-located under `database/prisma/` | **Selected for MVP** |
| 2. Build-time concatenation + ownership linter | Explicit copy from `modules/*/prisma` | Extra pipeline; easy to drift | Deferred — optional CLI compose later |
| 3. Postgres multi-schema + multiple Prisma clients | Strong plugin isolation | Cross-entity DX cost; multi-client complexity | Deferred for plugins if install/uninstall fails |

## Selected approach

**Native Prisma multi-file schema** under `database/prisma/`:

```text
database/prisma/
  schema.prisma   # generator + datasource (platform host)
  auth.prisma     # OWNER: auth module
```

- `prismaSchema` path: `database/prisma` (directory — Prisma merges all `*.prisma` files)
- Client generate output: `node_modules/.prisma/client` (consumed via `@prisma/client`)
- Module ownership is documented in-file (`// OWNER:`) and mirrored under `src/modules/auth/prisma/README.md`
- Plugins (later): separate package `prisma/` + install migrations applied by CLI; **never** patch core `*.prisma` files (CI check in Phase D/H)

## Spike proof (commands)

```bash
cd opoha-core
pnpm docker:up
export DATABASE_URL=postgresql://opoha:opoha@localhost:5433/opoha
pnpm prisma:generate
pnpm prisma:migrate -- --name auth_spike_init
```

Expected: client generates; migration creates `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `api_keys`.

## Plugin uninstall policy (decision for later)

- Plugin migrations live in the plugin repo and are recorded in a namespaced migration history (CLI concern — Phase G/D)
- Uninstall runs plugin down migrations only; core tables untouched
- Kill criteria from ADR-0005: if plugin install/uninstall cannot stay clean, reopen multi-schema option

## Follow-ups

- B-07 / Phase G: `opoha migrate` orchestration
- Phase D: ownership lint (forbid plugin packages from shipping diffs to `database/prisma/**`)
- Optional: compose script copying `src/modules/*/prisma/*.prisma` → `database/prisma/` before generate
