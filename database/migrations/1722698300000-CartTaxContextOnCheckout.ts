import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persist tax pricing mode + jurisdiction on carts for checkout calc (Phase 2 C-03).
 * OWNER: order module tables — tax-engine orchestrates calculation only.
 */
export class CartTaxContextOnCheckout1722698300000 implements MigrationInterface {
  name = 'CartTaxContextOnCheckout1722698300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD COLUMN "tax_pricing_mode" text NOT NULL DEFAULT 'exclusive',
        ADD COLUMN "tax_country_code" text,
        ADD COLUMN "tax_postal_code" text,
        ADD COLUMN "tax_province" text,
        ADD COLUMN "tax_provider_code" text,
        ADD COLUMN "tax_minor" bigint NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD CONSTRAINT "carts_tax_pricing_mode_check"
          CHECK ("tax_pricing_mode" IN ('inclusive', 'exclusive')),
        ADD CONSTRAINT "carts_tax_minor_nonneg_check"
          CHECK ("tax_minor" >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "carts"
        DROP CONSTRAINT IF EXISTS "carts_tax_minor_nonneg_check",
        DROP CONSTRAINT IF EXISTS "carts_tax_pricing_mode_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        DROP COLUMN IF EXISTS "tax_minor",
        DROP COLUMN IF EXISTS "tax_provider_code",
        DROP COLUMN IF EXISTS "tax_province",
        DROP COLUMN IF EXISTS "tax_postal_code",
        DROP COLUMN IF EXISTS "tax_country_code",
        DROP COLUMN IF EXISTS "tax_pricing_mode"
    `);
  }
}
