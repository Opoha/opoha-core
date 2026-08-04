/**
 * Consumer-safe migration runner — no tsx/typescript required.
 * Invoked via `node dist/database/run-migrations.js` (`pnpm db:migrate`).
 */
import 'reflect-metadata';

import dataSource from './data-source';

async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    const executed = await dataSource.runMigrations();
    if (executed.length === 0) {
      process.stdout.write('No pending migrations.\n');
    } else {
      for (const migration of executed) {
        process.stdout.write(`Migration ${migration.name} executed\n`);
      }
    }
  } finally {
    await dataSource.destroy();
  }
}

function formatMigrationError(error: unknown): string {
  if (error instanceof AggregateError) {
    const parts = error.errors.map((e) =>
      e instanceof Error ? e.message || (e as NodeJS.ErrnoException).code || String(e) : String(e),
    );
    return (
      error.message ||
      (error as NodeJS.ErrnoException).code ||
      parts.filter(Boolean).join('; ') ||
      'connection failed'
    );
  }
  if (error instanceof Error) {
    return error.message || (error as NodeJS.ErrnoException).code || String(error);
  }
  return String(error);
}

function isConnectionRefused(message: string): boolean {
  return /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|connect\s+ECONNREFUSED/i.test(message);
}

main().catch((error: unknown) => {
  const message = formatMigrationError(error);
  process.stderr.write(`Migration failed: ${message}\n`);
  if (isConnectionRefused(message)) {
    process.stderr.write(
      'Hint: Postgres is not reachable. From your app root run `docker compose up -d`,\n' +
        'wait until healthy (`docker compose ps`), then check DATABASE_URL in `.env`\n' +
        '(default: postgresql://opoha:opoha@localhost:5433/opoha).\n',
    );
  }
  process.exitCode = 1;
});
