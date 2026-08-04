import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catalog products + variants.
 * Money stored as integer minor units + ISO currency code.
 */
export class CatalogProductsInit1722686200000 implements MigrationInterface {
  name = 'CatalogProductsInit1722686200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "products_slug_key" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "products_created_at_idx" ON "products" ("created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE TABLE "product_variants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "sku" text NOT NULL,
        "name" text,
        "price_minor" bigint NOT NULL,
        "currency_code" text NOT NULL DEFAULT 'USD',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "product_variants_sku_key" UNIQUE ("sku"),
        CONSTRAINT "product_variants_product_id_fkey"
          FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "product_variants_product_id_idx" ON "product_variants" ("product_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product_variants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
  }
}
