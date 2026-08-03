import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 C-01 — product/category translation storage (TypeORM).
 *
 * OWNER: catalog module — plugins must not alter these tables.
 * Pattern: base row = default locale; translation rows = locale overrides.
 */
export class CatalogTranslationsInit1722717000000
  implements MigrationInterface
{
  name = 'CatalogTranslationsInit1722717000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "product_translations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "locale" text NOT NULL,
        "name" text NOT NULL,
        "slug" text,
        "description" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "product_translations_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "product_translations_product_id_fkey"
          FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "product_translations_product_id_locale_key"
          UNIQUE ("product_id", "locale")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "product_translations_locale_idx"
        ON "product_translations" ("locale")
    `);

    await queryRunner.query(`
      CREATE TABLE "category_translations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "category_id" uuid NOT NULL,
        "locale" text NOT NULL,
        "name" text NOT NULL,
        "slug" text,
        "description" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "category_translations_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "category_translations_category_id_fkey"
          FOREIGN KEY ("category_id")
          REFERENCES "categories"("id") ON DELETE CASCADE,
        CONSTRAINT "category_translations_category_id_locale_key"
          UNIQUE ("category_id", "locale")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "category_translations_locale_idx"
        ON "category_translations" ("locale")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "category_translations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_translations"`);
  }
}
