/**
 * TypeORM seed entry — run via `pnpm db:seed`.
 */
import { config as loadDotenv } from 'dotenv';

import {
  resolveSeedAdminFromEnv,
  seedAuth,
} from '../src/modules/auth/seed/seed-auth';
import { createTypeOrmSeedStore } from '../src/modules/auth/seed/typeorm-seed-store';
import dataSource from './data-source';

loadDotenv();

async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    const store = createTypeOrmSeedStore(dataSource);
    const result = await seedAuth(store, resolveSeedAdminFromEnv());
    const perms = result.permissionKeys.length;
    process.stdout.write(
      `Seed complete: role="${result.roleName}" permissions=${perms}`,
    );
    if (result.adminUserCreated) {
      process.stdout.write(' adminUser=created');
    } else if (result.adminUserLinked) {
      process.stdout.write(' adminUser=linked');
    } else if (result.adminSkippedReason === 'env_incomplete') {
      process.stdout.write(
        ' adminUser=skipped (set both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD)',
      );
    } else {
      process.stdout.write(' adminUser=skipped (roles/permissions only)');
    }
    process.stdout.write('\n');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Seed failed: ${message}\n`);
  process.exitCode = 1;
});
