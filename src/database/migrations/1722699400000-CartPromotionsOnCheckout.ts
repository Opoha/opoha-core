import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persist coupon code + discount snapshot on carts/orders for PromotionsEngine.
 * OWNER: order module tables — promotions-engine orchestrates calculation only.
 */
export class CartPromotionsOnCheckout1722699400000 implements MigrationInterface {
  name = 'CartPromotionsOnCheckout1722699400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD COLUMN "coupon_code" text,
        ADD COLUMN "discount_minor" bigint NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD CONSTRAINT "carts_discount_minor_nonneg_check"
          CHECK ("discount_minor" >= 0)
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "discount_minor" bigint NOT NULL DEFAULT 0,
        ADD COLUMN "coupon_code" text
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD CONSTRAINT "orders_discount_minor_nonneg_check"
          CHECK ("discount_minor" >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP CONSTRAINT IF EXISTS "orders_discount_minor_nonneg_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "coupon_code",
        DROP COLUMN IF EXISTS "discount_minor"
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        DROP CONSTRAINT IF EXISTS "carts_discount_minor_nonneg_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        DROP COLUMN IF EXISTS "discount_minor",
        DROP COLUMN IF EXISTS "coupon_code"
    `);
  }
}
