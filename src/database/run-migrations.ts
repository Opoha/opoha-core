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

main().catch((error: unknown) => {
  let message: string;
  if (error instanceof AggregateError) {
    const parts = error.errors.map((e) =>
      e instanceof Error ? e.message || (e as NodeJS.ErrnoException).code || String(e) : String(e),
    );
    message =
      error.message ||
      (error as NodeJS.ErrnoException).code ||
      parts.filter(Boolean).join('; ') ||
      'connection failed';
  } else if (error instanceof Error) {
    message = error.message || (error as NodeJS.ErrnoException).code || String(error);
  } else {
    message = String(error);
  }
  process.stderr.write(`Migration failed: ${message}\n`);
  process.exitCode = 1;
});
