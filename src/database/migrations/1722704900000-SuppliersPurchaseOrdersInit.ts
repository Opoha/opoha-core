import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Suppliers + purchase orders (draft → receive into location stock).
 */
export class SuppliersPurchaseOrdersInit1722704900000 implements MigrationInterface {
  name = 'SuppliersPurchaseOrdersInit1722704900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "suppliers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "email" text,
        "phone" text,
        "contact_name" text,
        "address_line1" text,
        "address_line2" text,
        "city" text,
        "province" text,
        "postal_code" text,
        "country_code" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "suppliers_code_uidx" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "suppliers_is_active_idx" ON "suppliers" ("is_active")
    `);

    await queryRunner.query(`
      CREATE TABLE "purchase_orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "supplier_id" uuid NOT NULL,
        "warehouse_id" uuid NOT NULL,
        "status" text NOT NULL DEFAULT 'draft',
        "notes" text,
        "received_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "purchase_orders_supplier_fkey"
          FOREIGN KEY ("supplier_id")
          REFERENCES "suppliers"("id") ON DELETE RESTRICT,
        CONSTRAINT "purchase_orders_warehouse_fkey"
          FOREIGN KEY ("warehouse_id")
          REFERENCES "warehouses"("id") ON DELETE RESTRICT,
        CONSTRAINT "purchase_orders_status_check"
          CHECK ("status" IN ('draft', 'received', 'cancelled'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "purchase_orders_supplier_id_idx"
        ON "purchase_orders" ("supplier_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "purchase_orders_warehouse_id_idx"
        ON "purchase_orders" ("warehouse_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "purchase_orders_status_idx"
        ON "purchase_orders" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "purchase_orders_created_at_idx"
        ON "purchase_orders" ("created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "purchase_order_lines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "purchase_order_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "quantity_received" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "purchase_order_lines_po_fkey"
          FOREIGN KEY ("purchase_order_id")
          REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
        CONSTRAINT "purchase_order_lines_variant_fkey"
          FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id") ON DELETE RESTRICT,
        CONSTRAINT "purchase_order_lines_po_variant_key"
          UNIQUE ("purchase_order_id", "variant_id"),
        CONSTRAINT "purchase_order_lines_quantity_pos_check"
          CHECK ("quantity" > 0),
        CONSTRAINT "purchase_order_lines_qty_received_check"
          CHECK ("quantity_received" >= 0 AND "quantity_received" <= "quantity")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "purchase_order_lines_purchase_order_id_idx"
        ON "purchase_order_lines" ("purchase_order_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_order_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suppliers"`);
  }
}
