import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 F-04 — B2B customer-specific price list items.
 *
 * OWNER: b2b module — plugins must not alter this table.
 * Cross-module FKs to `companies.id` and `product_variants.id`
 * (ADR-0005 / ADR-0010).
 */
export class B2bPriceLists1722723600000 implements MigrationInterface {
  name = 'B2bPriceLists1722723600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "company_price_list_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "price_minor" bigint NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "company_price_list_items_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "company_price_list_items_company_variant_key"
          UNIQUE ("company_id", "variant_id"),
        CONSTRAINT "company_price_list_items_company_id_fkey"
          FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "company_price_list_items_variant_id_fkey"
          FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "company_price_list_items_company_id_idx"
        ON "company_price_list_items" ("company_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "company_price_list_items_company_id_idx"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "company_price_list_items"`,
    );
  }
}
