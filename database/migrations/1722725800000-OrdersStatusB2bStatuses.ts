import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 F-03 / H-02 — allow B2B order statuses `draft` and `approved`
 * on `orders.status` check constraint (was pending|confirmed|fulfilled|cancelled).
 *
 * OWNER: order module (ADR-0005 / ADR-0010).
 */
export class OrdersStatusB2bStatuses1722725800000 implements MigrationInterface {
  name = 'OrdersStatusB2bStatuses1722725800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_status_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD CONSTRAINT "orders_status_check"
        CHECK ("status" IN (
          'pending',
          'confirmed',
          'fulfilled',
          'cancelled',
          'draft',
          'approved'
        ))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_status_check"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD CONSTRAINT "orders_status_check"
        CHECK ("status" IN (
          'pending',
          'confirmed',
          'fulfilled',
          'cancelled'
        ))
    `);
  }
}
