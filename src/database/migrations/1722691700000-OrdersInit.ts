import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Carts, cart lines, orders, and order lines.
 */
export class OrdersInit1722691700000 implements MigrationInterface {
  name = 'OrdersInit1722691700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "carts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "customer_id" uuid,
        "status" text NOT NULL DEFAULT 'open',
        "currency_code" text NOT NULL DEFAULT 'USD',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "carts_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "carts_customer_fkey"
          FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE SET NULL,
        CONSTRAINT "carts_status_check"
          CHECK ("status" IN ('open', 'locked', 'converted', 'abandoned'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "carts_customer_id_idx" ON "carts" ("customer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "carts_created_at_idx" ON "carts" ("created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "cart_lines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "cart_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "unit_price_minor" bigint NOT NULL,
        "reservation_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "cart_lines_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "cart_lines_cart_variant_key" UNIQUE ("cart_id", "variant_id"),
        CONSTRAINT "cart_lines_cart_fkey"
          FOREIGN KEY ("cart_id")
          REFERENCES "carts"("id") ON DELETE CASCADE,
        CONSTRAINT "cart_lines_variant_fkey"
          FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id") ON DELETE RESTRICT,
        CONSTRAINT "cart_lines_quantity_pos_check"
          CHECK ("quantity" > 0),
        CONSTRAINT "cart_lines_unit_price_nonneg_check"
          CHECK ("unit_price_minor" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "cart_lines_cart_id_idx" ON "cart_lines" ("cart_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "customer_id" uuid,
        "cart_id" uuid,
        "status" text NOT NULL DEFAULT 'pending',
        "currency_code" text NOT NULL DEFAULT 'USD',
        "subtotal_minor" bigint NOT NULL DEFAULT 0,
        "tax_minor" bigint NOT NULL DEFAULT 0,
        "shipping_minor" bigint NOT NULL DEFAULT 0,
        "total_minor" bigint NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "orders_customer_fkey"
          FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE SET NULL,
        CONSTRAINT "orders_cart_fkey"
          FOREIGN KEY ("cart_id")
          REFERENCES "carts"("id") ON DELETE SET NULL,
        CONSTRAINT "orders_status_check"
          CHECK ("status" IN ('pending', 'confirmed', 'fulfilled', 'cancelled')),
        CONSTRAINT "orders_amounts_nonneg_check"
          CHECK (
            "subtotal_minor" >= 0
            AND "tax_minor" >= 0
            AND "shipping_minor" >= 0
            AND "total_minor" >= 0
          )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "orders_customer_id_idx" ON "orders" ("customer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "orders_status_idx" ON "orders" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "orders_created_at_idx" ON "orders" ("created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "order_lines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "unit_price_minor" bigint NOT NULL,
        "line_total_minor" bigint NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "order_lines_order_fkey"
          FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "order_lines_variant_fkey"
          FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id") ON DELETE RESTRICT,
        CONSTRAINT "order_lines_quantity_pos_check"
          CHECK ("quantity" > 0),
        CONSTRAINT "order_lines_amounts_nonneg_check"
          CHECK ("unit_price_minor" >= 0 AND "line_total_minor" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "order_lines_order_id_idx" ON "order_lines" ("order_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "order_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cart_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "carts"`);
  }
}
