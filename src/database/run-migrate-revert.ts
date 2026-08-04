/**
 * Consumer-safe migration revert — no tsx/typescript required.
 */
import 'reflect-metadata';

import dataSource from './data-source';

async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    await dataSource.undoLastMigration();
    process.stdout.write('Reverted last migration.\n');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Migration revert failed: ${message}\n`);
  process.exitCode = 1;
});
