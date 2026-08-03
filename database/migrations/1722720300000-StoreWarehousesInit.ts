import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 E-01 — store ↔ warehouse many-to-many association.
 *
 * OWNER: warehouses module — plugins must not alter this table.
 * Cross-module FK to `stores.id`; warehouse FK within warehouses (ADR-0005 / ADR-0010).
 *
 * Backfill: every existing store is linked to every existing warehouse so single-store
 * and pre-E-01 deployments keep global allocation behavior. Default warehouses are
 * marked primary per store.
 */
export class StoreWarehousesInit1722720300000 implements MigrationInterface {
  name = 'StoreWarehousesInit1722720300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "store_warehouses" (
        "store_id" uuid NOT NULL,
        "warehouse_id" uuid NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "store_warehouses_pkey" PRIMARY KEY ("store_id", "warehouse_id"),
        CONSTRAINT "store_warehouses_store_id_fkey"
          FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE CASCADE,
        CONSTRAINT "store_warehouses_warehouse_id_fkey"
          FOREIGN KEY ("warehouse_id")
          REFERENCES "warehouses"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "store_warehouses_one_primary_uidx"
        ON "store_warehouses" ("store_id")
        WHERE "is_primary" = true
    `);

    await queryRunner.query(`
      CREATE INDEX "store_warehouses_warehouse_id_idx"
        ON "store_warehouses" ("warehouse_id")
    `);

    await queryRunner.query(`
      INSERT INTO "store_warehouses" (
        "store_id",
        "warehouse_id",
        "is_primary"
      )
      SELECT
        s."id",
        w."id",
        COALESCE(w."is_default", false)
      FROM "stores" s
      CROSS JOIN "warehouses" w
      WHERE NOT EXISTS (
        SELECT 1
        FROM "store_warehouses" sw
        WHERE sw."store_id" = s."id"
          AND sw."warehouse_id" = w."id"
      )
    `);

    // If a store has no default warehouse linked as primary, promote the first link.
    await queryRunner.query(`
      UPDATE "store_warehouses" sw
      SET "is_primary" = true
      WHERE sw."warehouse_id" = (
        SELECT sw2."warehouse_id"
        FROM "store_warehouses" sw2
        WHERE sw2."store_id" = sw."store_id"
        ORDER BY sw2."warehouse_id" ASC
        LIMIT 1
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "store_warehouses" sw3
        WHERE sw3."store_id" = sw."store_id"
          AND sw3."is_primary" = true
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "store_warehouses"`);
  }
}
