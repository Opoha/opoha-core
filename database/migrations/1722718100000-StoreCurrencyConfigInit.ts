import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 D-01 — store-scoped display vs settlement currency config.
 *
 * OWNER: currency module — plugins must not alter this table.
 * Cross-module FK to `stores.id` only (ADR-0005 / ADR-0010).
 *
 * Existing stores inherit `default_currency_code` for both display and settlement.
 */
export class StoreCurrencyConfigInit1722718100000 implements MigrationInterface {
  name = 'StoreCurrencyConfigInit1722718100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "store_currency_config" (
        "store_id" uuid NOT NULL,
        "settlement_currency_code" text NOT NULL,
        "display_currency_code" text NOT NULL,
        "enabled_display_currencies" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "store_currency_config_pkey" PRIMARY KEY ("store_id"),
        CONSTRAINT "store_currency_config_store_id_fkey"
          FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO "store_currency_config" (
        "store_id",
        "settlement_currency_code",
        "display_currency_code",
        "enabled_display_currencies"
      )
      SELECT
        s."id",
        UPPER(s."default_currency_code"),
        UPPER(s."default_currency_code"),
        jsonb_build_array(UPPER(s."default_currency_code"))
      FROM "stores" s
      WHERE NOT EXISTS (
        SELECT 1
        FROM "store_currency_config" c
        WHERE c."store_id" = s."id"
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "store_currency_config"`);
  }
}
