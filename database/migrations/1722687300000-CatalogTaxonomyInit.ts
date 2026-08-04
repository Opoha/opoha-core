import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catalog categories (hierarchical), collections, and brands.
 */
export class CatalogTaxonomyInit1722687300000 implements MigrationInterface {
  name = 'CatalogTaxonomyInit1722687300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "parent_id" uuid,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "categories_slug_key" UNIQUE ("slug"),
        CONSTRAINT "categories_parent_id_fkey"
          FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "categories_parent_id_idx" ON "categories" ("parent_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "categories_created_at_idx" ON "categories" ("created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "collections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "collections_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "collections_slug_key" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "collections_created_at_idx" ON "collections" ("created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "brands" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "brands_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "brands_slug_key" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "brands_created_at_idx" ON "brands" ("created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "brands"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "collections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
  }
}
