# TypeORM Ownership Spike

Canonical: opoha-workspace/docs/research/2026-08-03-typeorm-ownership-spike.md

Entities: `src/modules/auth/entities/`
DataSource: `database/data-source.ts`
Migrations: `database/migrations/`

```bash
pnpm db:migrate
pnpm db:seed
```

Reset DB volume if prior Prisma migrations exist.
