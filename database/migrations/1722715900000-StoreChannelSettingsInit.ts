import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 B-03 — store-scoped channel settings via configuration module.
 *
 * OWNER: configuration module — plugins must not alter this table.
 * Cross-module FK to `stores.id` only (ADR-0005 / ADR-0010).
 *
 * Existing stores get default rows (UTC / US / shared catalog mode).
 */
export class StoreChannelSettingsInit1722715900000 implements MigrationInterface {
  name = 'StoreChannelSettingsInit1722715900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "store_channel_settings" (
        "store_id" uuid NOT NULL,
        "timezone" text NOT NULL DEFAULT 'UTC',
        "country_code" text NOT NULL DEFAULT 'US',
        "catalog_mode" text NOT NULL DEFAULT 'shared',
        "settings_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "store_channel_settings_pkey" PRIMARY KEY ("store_id"),
        CONSTRAINT "store_channel_settings_store_id_fkey"
          FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE CASCADE,
        CONSTRAINT "store_channel_settings_catalog_mode_check"
          CHECK ("catalog_mode" IN ('shared', 'isolated'))
      )
    `);

    await queryRunner.query(`
      INSERT INTO "store_channel_settings" (
        "store_id", "timezone", "country_code", "catalog_mode", "settings_json"
      )
      SELECT
        s."id",
        'UTC',
        'US',
        'shared',
        '{}'::jsonb
      FROM "stores" s
      WHERE NOT EXISTS (
        SELECT 1
        FROM "store_channel_settings" c
        WHERE c."store_id" = s."id"
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "store_channel_settings"`);
  }
}
