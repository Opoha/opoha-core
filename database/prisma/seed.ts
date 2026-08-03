/**
 * Prisma seed entry — run via `pnpm db:seed` / `pnpm prisma:seed`.
 *
 * Seeds default admin role + permissions idempotently.
 * Optional admin user when both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are set.
 */
import { config as loadDotenv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

import {
  resolveSeedAdminFromEnv,
  seedAuth,
} from '../../src/modules/auth/seed/seed-auth';

loadDotenv();

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const result = await seedAuth(prisma, resolveSeedAdminFromEnv());
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
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Seed failed: ${message}\n`);
  process.exitCode = 1;
});
