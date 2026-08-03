import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 7 C-01 / C-02 — marketplace vendors + product/order routing columns.
 *
 * OWNER notes (ADR-0005 / ADR-0010):
 * - `vendors` — vendors module
 * - `products.vendor_id` — catalog module column (FK to vendors)
 * - `orders.vendor_id` / `order_lines.vendor_id` — order module columns (FK to vendors)
 *
 * Plugins must not alter these tables.
 */
export class MarketplaceVendorsInit1722729100000 implements MigrationInterface {
  name = 'MarketplaceVendorsInit1722729100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "vendors" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "store_id" uuid,
        "commission_bps" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "email" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "vendors_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "vendors_code_uidx" UNIQUE ("code"),
        CONSTRAINT "vendors_store_id_fkey"
          FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE SET NULL,
        CONSTRAINT "vendors_commission_bps_check"
          CHECK ("commission_bps" >= 0 AND "commission_bps" <= 10000)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "vendors_store_id_idx" ON "vendors" ("store_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN "vendor_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX "products_vendor_id_idx" ON "products" ("vendor_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD CONSTRAINT "products_vendor_id_fkey"
        FOREIGN KEY ("vendor_id")
        REFERENCES "vendors"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "vendor_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX "orders_vendor_id_idx" ON "orders" ("vendor_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD CONSTRAINT "orders_vendor_id_fkey"
        FOREIGN KEY ("vendor_id")
        REFERENCES "vendors"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "order_lines"
        ADD COLUMN "vendor_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX "order_lines_vendor_id_idx" ON "order_lines" ("vendor_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "order_lines"
        ADD CONSTRAINT "order_lines_vendor_id_fkey"
        FOREIGN KEY ("vendor_id")
        REFERENCES "vendors"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order_lines" DROP CONSTRAINT IF EXISTS "order_lines_vendor_id_fkey"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "order_lines_vendor_id_idx"`);
    await queryRunner.query(`
      ALTER TABLE "order_lines" DROP COLUMN IF EXISTS "vendor_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_vendor_id_fkey"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "orders_vendor_id_idx"`);
    await queryRunner.query(`
      ALTER TABLE "orders" DROP COLUMN IF EXISTS "vendor_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_vendor_id_fkey"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "products_vendor_id_idx"`);
    await queryRunner.query(`
      ALTER TABLE "products" DROP COLUMN IF EXISTS "vendor_id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "vendors"`);
  }
}
