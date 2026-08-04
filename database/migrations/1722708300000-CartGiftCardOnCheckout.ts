import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persist gift card code + applied amount on carts/orders (Phase 4 C-02).
 * OWNER: order module tables — gift-cards module owns balances only.
 */
export class CartGiftCardOnCheckout1722708300000 implements MigrationInterface {
  name = 'CartGiftCardOnCheckout1722708300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD COLUMN "gift_card_code" text,
        ADD COLUMN "gift_card_minor" bigint NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD CONSTRAINT "carts_gift_card_minor_nonneg_check"
          CHECK ("gift_card_minor" >= 0)
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "gift_card_code" text,
        ADD COLUMN "gift_card_minor" bigint NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD CONSTRAINT "orders_gift_card_minor_nonneg_check"
          CHECK ("gift_card_minor" >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP CONSTRAINT IF EXISTS "orders_gift_card_minor_nonneg_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "gift_card_minor",
        DROP COLUMN IF EXISTS "gift_card_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        DROP CONSTRAINT IF EXISTS "carts_gift_card_minor_nonneg_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "carts"
        DROP COLUMN IF EXISTS "gift_card_minor",
        DROP COLUMN IF EXISTS "gift_card_code"
    `);
  }
}
