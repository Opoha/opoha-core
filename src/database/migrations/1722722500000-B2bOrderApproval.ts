import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B2B company scope on carts/orders + draft/approved statuses.
 *
 * OWNER: order module tables — `company_id` references b2b `companies.id`
 * by FK only (ADR-0005 / ADR-0010).
 */
export class B2bOrderApproval1722722500000 implements MigrationInterface {
  name = 'B2bOrderApproval1722722500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD COLUMN "company_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "carts"
        ADD CONSTRAINT "carts_company_id_fkey"
        FOREIGN KEY ("company_id")
        REFERENCES "companies"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "carts_company_id_idx" ON "carts" ("company_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "company_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD CONSTRAINT "orders_company_id_fkey"
        FOREIGN KEY ("company_id")
        REFERENCES "companies"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "orders_company_id_idx" ON "orders" ("company_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "orders_company_id_idx"`);
    await queryRunner.query(`
      ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_company_id_fkey"
    `);
    await queryRunner.query(`
      ALTER TABLE "orders" DROP COLUMN IF EXISTS "company_id"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "carts_company_id_idx"`);
    await queryRunner.query(`
      ALTER TABLE "carts" DROP CONSTRAINT IF EXISTS "carts_company_id_fkey"
    `);
    await queryRunner.query(`
      ALTER TABLE "carts" DROP COLUMN IF EXISTS "company_id"
    `);
  }
}
