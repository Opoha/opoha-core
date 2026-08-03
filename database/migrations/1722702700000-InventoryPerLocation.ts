import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3 B-01 — per-location inventory stock.
 * Composite unique (variant_id, warehouse_id); backfill default warehouse.
 */
export class InventoryPerLocation1722702700000 implements MigrationInterface {
  name = 'InventoryPerLocation1722702700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure a default warehouse exists for legacy single-pool rows.
    await queryRunner.query(`
      INSERT INTO "warehouses" (
        "id", "code", "name", "description", "is_active", "is_default"
      )
      SELECT
        gen_random_uuid(),
        'DEFAULT',
        'Default warehouse',
        'Auto-created for per-location inventory migration',
        true,
        true
      WHERE NOT EXISTS (
        SELECT 1 FROM "warehouses" WHERE "is_default" = true
      )
      AND NOT EXISTS (
        SELECT 1 FROM "warehouses" WHERE "code" = 'DEFAULT'
      )
    `);

    // If DEFAULT code exists but nothing is marked default, promote it.
    await queryRunner.query(`
      UPDATE "warehouses"
      SET "is_default" = true
      WHERE "code" = 'DEFAULT'
        AND NOT EXISTS (
          SELECT 1 FROM "warehouses" w2 WHERE w2."is_default" = true
        )
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_items"
        ADD COLUMN "warehouse_id" uuid
    `);

    await queryRunner.query(`
      UPDATE "inventory_items"
      SET "warehouse_id" = (
        SELECT "id" FROM "warehouses" WHERE "is_default" = true LIMIT 1
      )
      WHERE "warehouse_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_items"
        ALTER COLUMN "warehouse_id" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_items"
        DROP CONSTRAINT "inventory_items_variant_id_key"
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_items"
        ADD CONSTRAINT "inventory_items_variant_warehouse_key"
          UNIQUE ("variant_id", "warehouse_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_items"
        ADD CONSTRAINT "inventory_items_warehouse_fkey"
          FOREIGN KEY ("warehouse_id")
          REFERENCES "warehouses"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE INDEX "inventory_items_warehouse_id_idx"
        ON "inventory_items" ("warehouse_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "inventory_items_warehouse_id_idx"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items"
        DROP CONSTRAINT IF EXISTS "inventory_items_warehouse_fkey"
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items"
        DROP CONSTRAINT IF EXISTS "inventory_items_variant_warehouse_key"
    `);

    // Collapse to one row per variant (keep default warehouse stock) before
    // restoring variant-only uniqueness — best-effort for reverse migrations.
    await queryRunner.query(`
      DELETE FROM "inventory_items" i
      WHERE i."warehouse_id" <> (
        SELECT "id" FROM "warehouses" WHERE "is_default" = true LIMIT 1
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "inventory_items"
        ADD CONSTRAINT "inventory_items_variant_id_key" UNIQUE ("variant_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "inventory_items"
        DROP COLUMN "warehouse_id"
    `);
  }
}
