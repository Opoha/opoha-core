import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Products and variants carry fulfillment_mode (physical | digital | service).
 * (physical | digital | service). Default physical for existing rows.
 *
 * OWNER: catalog module — plugins must not alter these tables.
 */
export class CatalogFulfillmentMode1722726900000 implements MigrationInterface {
  name = 'CatalogFulfillmentMode1722726900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN "fulfillment_mode" text NOT NULL DEFAULT 'physical'
    `);
    await queryRunner.query(`
      ALTER TABLE "product_variants"
        ADD COLUMN "fulfillment_mode" text NOT NULL DEFAULT 'physical'
    `);
    await queryRunner.query(`
      CREATE INDEX "products_fulfillment_mode_idx"
        ON "products" ("fulfillment_mode")
    `);
    await queryRunner.query(`
      CREATE INDEX "product_variants_fulfillment_mode_idx"
        ON "product_variants" ("fulfillment_mode")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "product_variants_fulfillment_mode_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "products_fulfillment_mode_idx"`);
    await queryRunner.query(`
      ALTER TABLE "product_variants"
        DROP COLUMN IF EXISTS "fulfillment_mode"
    `);
    await queryRunner.query(`
      ALTER TABLE "products"
        DROP COLUMN IF EXISTS "fulfillment_mode"
    `);
  }
}
