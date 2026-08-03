import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persist selected shipping method/rate on carts and orders (Phase 2 B-02).
 * OWNER: order module tables — shipping-engine orchestrates quotes only.
 */
export class ShippingSelectionOnCheckout1722696100000
  implements MigrationInterface
{
  name = 'ShippingSelectionOnCheckout1722696100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD COLUMN "shipping_method_code" text,
        ADD COLUMN "shipping_rate_code" text,
        ADD COLUMN "shipping_minor" bigint NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD CONSTRAINT "carts_shipping_minor_nonneg_check"
          CHECK ("shipping_minor" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "shipping_method_code" text,
        ADD COLUMN "shipping_rate_code" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "shipping_rate_code",
        DROP COLUMN IF EXISTS "shipping_method_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        DROP CONSTRAINT IF EXISTS "carts_shipping_minor_nonneg_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        DROP COLUMN IF EXISTS "shipping_minor",
        DROP COLUMN IF EXISTS "shipping_rate_code",
        DROP COLUMN IF EXISTS "shipping_method_code"
    `);
  }
}
