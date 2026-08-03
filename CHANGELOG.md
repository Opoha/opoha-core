# Changelog

All notable changes to `@opoha/core` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-08-04

First stable release. Public API freeze for GraphQL, domain events, and plugin host surfaces. Persistence remains TypeORM only (ADR-0010).

### Added

- Stability / security / performance / DX / official plugin compatibility gates for v1.0.
- Automation surfaces from v0.9 (jobs, rules, webhooks) remain part of the stable spine.

### Changed

- Package version staged at `1.0.0` (registry publish is separate / user-gated).

### Fixed

- `OrderCreated` event payload schema accepts `orderSource` (web/pos/marketplace) so placeOrder no longer fails Zod strict validation.

### Deprecated

- Prefer `PaymentCaptured` over the kept `PaymentSucceeded` event alias (see upgrade guide).

### Migration

- Operators on v0.9: follow [upgrade guide v0.9 → v1.0](../opoha-workspace/docs/readiness/upgrade-guide-v0.9-to-v1.0.md) (docs site: `opoha-docs/docs/upgrade-from-v0.9.md`).
- GraphQL removals after 1.0 follow the [deprecation policy](../opoha-workspace/docs/readiness/graphql-deprecation-policy.md) (minimum one minor before removal).

## [0.1.0] — 2026-08-03

Pre-1.0 development line (MVP through v0.9 Automation).
