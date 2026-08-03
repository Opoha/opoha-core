import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Warehouses / inventory locations (Phase 3 A-01).
 */
export class WarehousesInit1722701600000 implements MigrationInterface {
  name = 'WarehousesInit1722701600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "warehouses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_default" boolean NOT NULL DEFAULT false,
        "address_line1" text,
        "address_line2" text,
        "city" text,
        "province" text,
        "postal_code" text,
        "country_code" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "warehouses_code_key" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "warehouses_one_default_uidx"
        ON "warehouses" ("is_default")
        WHERE "is_default" = true
    `);
    await queryRunner.query(`
      CREATE INDEX "warehouses_created_at_idx"
        ON "warehouses" ("created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "warehouses_is_active_idx"
        ON "warehouses" ("is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "warehouses"`);
  }
}
