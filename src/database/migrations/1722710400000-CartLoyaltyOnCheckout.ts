import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persist loyalty redeem intent + applied amount on carts/orders.
 * OWNER: order module tables — loyalty module owns points balances only.
 */
export class CartLoyaltyOnCheckout1722710400000 implements MigrationInterface {
  name = 'CartLoyaltyOnCheckout1722710400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD COLUMN "loyalty_points_to_redeem" integer NOT NULL DEFAULT 0,
        ADD COLUMN "loyalty_minor" bigint NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD CONSTRAINT "carts_loyalty_points_to_redeem_nonneg_check"
          CHECK ("loyalty_points_to_redeem" >= 0),
        ADD CONSTRAINT "carts_loyalty_minor_nonneg_check"
          CHECK ("loyalty_minor" >= 0)
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "loyalty_points_redeemed" integer NOT NULL DEFAULT 0,
        ADD COLUMN "loyalty_minor" bigint NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD CONSTRAINT "orders_loyalty_points_redeemed_nonneg_check"
          CHECK ("loyalty_points_redeemed" >= 0),
        ADD CONSTRAINT "orders_loyalty_minor_nonneg_check"
          CHECK ("loyalty_minor" >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP CONSTRAINT IF EXISTS "orders_loyalty_minor_nonneg_check",
        DROP CONSTRAINT IF EXISTS "orders_loyalty_points_redeemed_nonneg_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "loyalty_minor",
        DROP COLUMN IF EXISTS "loyalty_points_redeemed"
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        DROP CONSTRAINT IF EXISTS "carts_loyalty_minor_nonneg_check",
        DROP CONSTRAINT IF EXISTS "carts_loyalty_points_to_redeem_nonneg_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        DROP COLUMN IF EXISTS "loyalty_minor",
        DROP COLUMN IF EXISTS "loyalty_points_to_redeem"
    `);
  }
}
