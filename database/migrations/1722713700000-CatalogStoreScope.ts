import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 B-01 — store association for catalog products/categories.
 *
 * Model (auto-decide):
 * - `store_id` NULL  → shared catalog row (visible to every store)
 * - `store_id` set   → store-owned / isolated to that store
 *
 * Migration strategy for existing single-store data:
 * - Ensure a default store row exists (idempotent seed)
 * - Add nullable `store_id` FK; leave existing rows NULL (shared)
 * - Replace global slug uniqueness with partial indexes
 *   (shared: unique slug among shared; owned: unique per store)
 *
 * OWNER: catalog module — plugins must not alter these tables.
 * Cross-module FK to `stores.id` only (ADR-0005).
 */
export class CatalogStoreScope1722713700000 implements MigrationInterface {
  name = 'CatalogStoreScope1722713700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotent default store for deployments that have catalog data but no store yet.
    await queryRunner.query(`
      INSERT INTO "stores" (
        "id", "code", "name", "description", "is_active", "is_default",
        "default_currency_code", "default_locale"
      )
      SELECT
        gen_random_uuid(),
        'DEFAULT',
        'Default store',
        'Auto-created for catalog store-scope migration (shared catalog default)',
        true,
        true,
        'USD',
        'en-US'
      WHERE NOT EXISTS (
        SELECT 1 FROM "stores" WHERE "is_default" = true
      )
      AND NOT EXISTS (
        SELECT 1 FROM "stores" WHERE "code" = 'DEFAULT'
      )
    `);

    await queryRunner.query(`
      UPDATE "stores"
      SET "is_default" = true
      WHERE "code" = 'DEFAULT'
        AND NOT EXISTS (
          SELECT 1 FROM "stores" s2 WHERE s2."is_default" = true
        )
    `);

    // --- products ---
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN "store_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD CONSTRAINT "products_store_id_fkey"
          FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
        DROP CONSTRAINT "products_slug_key"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "products_shared_slug_uidx"
        ON "products" ("slug")
        WHERE "store_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "products_store_slug_uidx"
        ON "products" ("store_id", "slug")
        WHERE "store_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "products_store_id_idx"
        ON "products" ("store_id")
    `);

    // --- categories ---
    await queryRunner.query(`
      ALTER TABLE "categories"
        ADD COLUMN "store_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "categories"
        ADD CONSTRAINT "categories_store_id_fkey"
          FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "categories"
        DROP CONSTRAINT "categories_slug_key"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "categories_shared_slug_uidx"
        ON "categories" ("slug")
        WHERE "store_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "categories_store_slug_uidx"
        ON "categories" ("store_id", "slug")
        WHERE "store_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "categories_store_id_idx"
        ON "categories" ("store_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "categories_store_id_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "categories_store_slug_uidx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "categories_shared_slug_uidx"`);
    await queryRunner.query(`
      ALTER TABLE "categories"
        DROP CONSTRAINT IF EXISTS "categories_store_id_fkey"
    `);
    await queryRunner.query(`
      ALTER TABLE "categories"
        DROP COLUMN IF EXISTS "store_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "categories"
        ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug")
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "products_store_id_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "products_store_slug_uidx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "products_shared_slug_uidx"`);
    await queryRunner.query(`
      ALTER TABLE "products"
        DROP CONSTRAINT IF EXISTS "products_store_id_fkey"
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
        DROP COLUMN IF EXISTS "store_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD CONSTRAINT "products_slug_key" UNIQUE ("slug")
    `);
  }
}
