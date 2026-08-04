import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fulfillments (pick → pack → ship) with lines + packages.
 */
export class FulfillmentsInit1722706000000 implements MigrationInterface {
  name = 'FulfillmentsInit1722706000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fulfillments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "warehouse_id" uuid NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "notes" text,
        "tracking_number" text,
        "picked_at" TIMESTAMPTZ,
        "packed_at" TIMESTAMPTZ,
        "shipped_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fulfillments_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "fulfillments_order_fkey"
          FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE RESTRICT,
        CONSTRAINT "fulfillments_warehouse_fkey"
          FOREIGN KEY ("warehouse_id")
          REFERENCES "warehouses"("id") ON DELETE RESTRICT,
        CONSTRAINT "fulfillments_status_check"
          CHECK ("status" IN ('pending', 'picked', 'packed', 'shipped', 'cancelled'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "fulfillments_order_id_idx"
        ON "fulfillments" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "fulfillments_warehouse_id_idx"
        ON "fulfillments" ("warehouse_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "fulfillments_status_idx"
        ON "fulfillments" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "fulfillments_created_at_idx"
        ON "fulfillments" ("created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "fulfillment_lines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "fulfillment_id" uuid NOT NULL,
        "order_line_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fulfillment_lines_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "fulfillment_lines_fulfillment_fkey"
          FOREIGN KEY ("fulfillment_id")
          REFERENCES "fulfillments"("id") ON DELETE CASCADE,
        CONSTRAINT "fulfillment_lines_order_line_fkey"
          FOREIGN KEY ("order_line_id")
          REFERENCES "order_lines"("id") ON DELETE RESTRICT,
        CONSTRAINT "fulfillment_lines_variant_fkey"
          FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fulfillment_lines_fulfillment_order_line_key"
          UNIQUE ("fulfillment_id", "order_line_id"),
        CONSTRAINT "fulfillment_lines_quantity_pos_check"
          CHECK ("quantity" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "fulfillment_lines_fulfillment_id_idx"
        ON "fulfillment_lines" ("fulfillment_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "fulfillment_lines_order_line_id_idx"
        ON "fulfillment_lines" ("order_line_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "fulfillment_packages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "fulfillment_id" uuid NOT NULL,
        "tracking_number" text,
        "carrier_code" text,
        "label_url" text,
        "weight_grams" integer,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "fulfillment_packages_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "fulfillment_packages_fulfillment_fkey"
          FOREIGN KEY ("fulfillment_id")
          REFERENCES "fulfillments"("id") ON DELETE CASCADE,
        CONSTRAINT "fulfillment_packages_weight_pos_check"
          CHECK ("weight_grams" IS NULL OR "weight_grams" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "fulfillment_packages_fulfillment_id_idx"
        ON "fulfillment_packages" ("fulfillment_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "fulfillment_packages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fulfillment_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fulfillments"`);
  }
}
