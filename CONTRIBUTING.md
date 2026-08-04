# Contributing to Opoha Core

Thanks for helping improve `@opoha/core`.

## Boundaries (non-negotiable)

- This package **must not** depend on `@opoha/plugin-*` or provider SDKs.
- Plugins load dynamically via `@opoha/plugin-sdk` + public APIs.
- Admin and SDK talk to core **only** through GraphQL.
- Do **not** commit `.env` or real secrets — use `.env.example`.

## Local development

```bash
pnpm install
pnpm docker:up
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Run `pnpm typecheck`, `pnpm test`, and `pnpm lint` before opening a PR.

## Ecosystem context

Architecture docs and roadmap live in [opoha-workspace](https://github.com/Opoha/opoha-workspace). Org-wide contribution notes: [CONTRIBUTING](https://github.com/Opoha/.github/blob/main/CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).
