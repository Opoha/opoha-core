import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stock transfers between warehouses (draft → ship → receive).
 */
export class StockTransfersInit1722703800000 implements MigrationInterface {
  name = 'StockTransfersInit1722703800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "stock_transfers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "from_warehouse_id" uuid NOT NULL,
        "to_warehouse_id" uuid NOT NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "notes" text,
        "shipped_at" TIMESTAMPTZ,
        "received_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "stock_transfers_from_warehouse_fkey"
          FOREIGN KEY ("from_warehouse_id")
          REFERENCES "warehouses"("id") ON DELETE RESTRICT,
        CONSTRAINT "stock_transfers_to_warehouse_fkey"
          FOREIGN KEY ("to_warehouse_id")
          REFERENCES "warehouses"("id") ON DELETE RESTRICT,
        CONSTRAINT "stock_transfers_status_check"
          CHECK ("status" IN ('draft', 'in_transit', 'received', 'cancelled')),
        CONSTRAINT "stock_transfers_distinct_warehouses_check"
          CHECK ("from_warehouse_id" <> "to_warehouse_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "stock_transfers_from_warehouse_id_idx"
        ON "stock_transfers" ("from_warehouse_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "stock_transfers_to_warehouse_id_idx"
        ON "stock_transfers" ("to_warehouse_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "stock_transfers_status_idx"
        ON "stock_transfers" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "stock_transfers_created_at_idx"
        ON "stock_transfers" ("created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "stock_transfer_lines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "transfer_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "stock_transfer_lines_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "stock_transfer_lines_transfer_fkey"
          FOREIGN KEY ("transfer_id")
          REFERENCES "stock_transfers"("id") ON DELETE CASCADE,
        CONSTRAINT "stock_transfer_lines_variant_fkey"
          FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id") ON DELETE RESTRICT,
        CONSTRAINT "stock_transfer_lines_transfer_variant_key"
          UNIQUE ("transfer_id", "variant_id"),
        CONSTRAINT "stock_transfer_lines_quantity_pos_check"
          CHECK ("quantity" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "stock_transfer_lines_transfer_id_idx"
        ON "stock_transfer_lines" ("transfer_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_transfer_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_transfers"`);
  }
}
