import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 7 A-03 — orders.order_source (web | pos | marketplace).
 * Default web for existing checkout orders.
 *
 * OWNER: order module — plugins must not alter this table.
 */
export class OrdersOrderSource1722728000000 implements MigrationInterface {
  name = 'OrdersOrderSource1722728000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "order_source" text NOT NULL DEFAULT 'web'
    `);
    await queryRunner.query(`
      CREATE INDEX "orders_order_source_idx"
        ON "orders" ("order_source")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "orders_order_source_idx"`);
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP COLUMN IF EXISTS "order_source"
    `);
  }
}
