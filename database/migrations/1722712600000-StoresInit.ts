import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Application-level stores / brands (Phase 5 A-01).
 * OWNER: stores module — plugins must not alter this table.
 */
export class StoresInit1722712600000 implements MigrationInterface {
  name = 'StoresInit1722712600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "stores" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "is_default" boolean NOT NULL DEFAULT false,
        "default_currency_code" text NOT NULL,
        "default_locale" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "stores_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "stores_code_key" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "stores_one_default_uidx"
        ON "stores" ("is_default")
        WHERE "is_default" = true
    `);
    await queryRunner.query(`
      CREATE INDEX "stores_created_at_idx"
        ON "stores" ("created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "stores_is_active_idx"
        ON "stores" ("is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stores"`);
  }
}
