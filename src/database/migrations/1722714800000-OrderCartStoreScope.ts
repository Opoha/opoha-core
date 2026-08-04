import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Carts and orders carry `store_id`; checkout validates store.
 *
 * Migration strategy for existing single-store data:
 * - Ensure a default store exists (idempotent; mirrors CatalogStoreScope)
 * - Add nullable `store_id`, backfill from default store, then NOT NULL
 *
 * OWNER: order module — plugins must not alter these tables.
 * Cross-module FK to `stores.id` only (ADR-0005 / ADR-0010).
 */
export class OrderCartStoreScope1722714800000 implements MigrationInterface {
  name = 'OrderCartStoreScope1722714800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "stores" (
        "id", "code", "name", "description", "is_active", "is_default",
        "default_currency_code", "default_locale"
      )
      SELECT
        gen_random_uuid(),
        'DEFAULT',
        'Default store',
        'Auto-created for order/cart store-scope migration',
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

    // --- carts ---
    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD COLUMN "store_id" uuid
    `);
    await queryRunner.query(`
      UPDATE "carts"
      SET "store_id" = (
        SELECT "id" FROM "stores" WHERE "is_default" = true LIMIT 1
      )
      WHERE "store_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        ALTER COLUMN "store_id" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD CONSTRAINT "carts_store_id_fkey"
          FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE INDEX "carts_store_id_idx"
        ON "carts" ("store_id")
    `);

    // --- orders ---
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "store_id" uuid
    `);
    await queryRunner.query(`
      UPDATE "orders"
      SET "store_id" = (
        SELECT "id" FROM "stores" WHERE "is_default" = true LIMIT 1
      )
      WHERE "store_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ALTER COLUMN "store_id" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD CONSTRAINT "orders_store_id_fkey"
          FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE INDEX "orders_store_id_idx"
        ON "orders" ("store_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "orders_store_id_idx"`);
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP CONSTRAINT IF EXISTS "orders_store_id_fkey"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "store_id"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "carts_store_id_idx"`);
    await queryRunner.query(`
      ALTER TABLE "carts"
        DROP CONSTRAINT IF EXISTS "carts_store_id_fkey"
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        DROP COLUMN IF EXISTS "store_id"
    `);
  }
}
