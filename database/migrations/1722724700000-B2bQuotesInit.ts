import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B2B buyer quote / purchase-order foundation.
 *
 * Distinct from supply `purchase_orders` (supplier inbound).
 * OWNER: b2b module — plugins must not alter these tables.
 */
export class B2bQuotesInit1722724700000 implements MigrationInterface {
  name = 'B2bQuotesInit1722724700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "b2b_quotes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "store_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "po_number" text,
        "status" text NOT NULL DEFAULT 'draft',
        "currency_code" text NOT NULL DEFAULT 'USD',
        "notes" text,
        "order_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "b2b_quotes_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "b2b_quotes_company_id_fkey"
          FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "b2b_quotes_store_id_fkey"
          FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE RESTRICT,
        CONSTRAINT "b2b_quotes_customer_id_fkey"
          FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE RESTRICT,
        CONSTRAINT "b2b_quotes_order_id_fkey"
          FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "b2b_quotes_company_id_idx" ON "b2b_quotes" ("company_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "b2b_quotes_store_id_idx" ON "b2b_quotes" ("store_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "b2b_quotes_status_idx" ON "b2b_quotes" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE "b2b_quote_lines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "quote_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "unit_price_minor" bigint NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "b2b_quote_lines_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "b2b_quote_lines_quote_id_fkey"
          FOREIGN KEY ("quote_id")
          REFERENCES "b2b_quotes"("id") ON DELETE CASCADE,
        CONSTRAINT "b2b_quote_lines_variant_id_fkey"
          FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "b2b_quote_lines_quote_id_idx"
        ON "b2b_quote_lines" ("quote_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "b2b_quote_lines_quote_id_idx"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "b2b_quote_lines"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "b2b_quotes_status_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "b2b_quotes_store_id_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "b2b_quotes_company_id_idx"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "b2b_quotes"`);
  }
}
