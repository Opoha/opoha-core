import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catalog attribute definitions/values + product media links (Phase 1 A-06/A-07).
 */
export class CatalogAttributesMediaInit1722688400000 implements MigrationInterface {
  name = 'CatalogAttributesMediaInit1722688400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attribute_definitions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "value_type" text NOT NULL DEFAULT 'text',
        "applies_to" text NOT NULL DEFAULT 'both',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "attribute_definitions_code_key" UNIQUE ("code"),
        CONSTRAINT "attribute_definitions_value_type_check"
          CHECK ("value_type" IN ('text', 'number', 'boolean')),
        CONSTRAINT "attribute_definitions_applies_to_check"
          CHECK ("applies_to" IN ('product', 'variant', 'both'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "attribute_definitions_created_at_idx"
        ON "attribute_definitions" ("created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "attribute_values" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "attribute_definition_id" uuid NOT NULL,
        "product_id" uuid,
        "variant_id" uuid,
        "value" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "attribute_values_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "attribute_values_definition_fkey"
          FOREIGN KEY ("attribute_definition_id")
          REFERENCES "attribute_definitions"("id") ON DELETE CASCADE,
        CONSTRAINT "attribute_values_product_fkey"
          FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "attribute_values_variant_fkey"
          FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id") ON DELETE CASCADE,
        CONSTRAINT "attribute_values_owner_xor_check"
          CHECK (
            ("product_id" IS NOT NULL AND "variant_id" IS NULL)
            OR ("product_id" IS NULL AND "variant_id" IS NOT NULL)
          )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "attribute_values_def_product_uidx"
        ON "attribute_values" ("attribute_definition_id", "product_id")
        WHERE "product_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "attribute_values_def_variant_uidx"
        ON "attribute_values" ("attribute_definition_id", "variant_id")
        WHERE "variant_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "attribute_values_product_id_idx"
        ON "attribute_values" ("product_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "attribute_values_variant_id_idx"
        ON "attribute_values" ("variant_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "product_media" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "file_id" uuid NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "alt_text" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "product_media_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "product_media_product_fkey"
          FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "product_media_product_file_key" UNIQUE ("product_id", "file_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "product_media_product_id_idx"
        ON "product_media" ("product_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "product_media_file_id_idx"
        ON "product_media" ("file_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product_media"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attribute_values"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attribute_definitions"`);
  }
}
