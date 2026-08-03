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

## Scripts

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

NestJS GraphQL shell lands in Phase A (task A-04+).

## Related

- ADR-0001 Modular Monolith
- ADR-0009 Multi-Repository Ecosystem
