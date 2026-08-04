import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Singleton localization settings.
 */
export class LocalizationInit1722692800000 implements MigrationInterface {
  name = 'LocalizationInit1722692800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "localization_settings" (
        "key" text NOT NULL,
        "country_code" text NOT NULL DEFAULT 'US',
        "currency_code" text NOT NULL DEFAULT 'USD',
        "timezone" text NOT NULL DEFAULT 'UTC',
        "default_locale" text NOT NULL DEFAULT 'en-US',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "localization_settings_pkey" PRIMARY KEY ("key"),
        CONSTRAINT "localization_settings_singleton_check"
          CHECK ("key" = 'default')
      )
    `);
    await queryRunner.query(`
      INSERT INTO "localization_settings" (
        "key",
        "country_code",
        "currency_code",
        "timezone",
        "default_locale"
      ) VALUES (
        'default',
        'US',
        'USD',
        'UTC',
        'en-US'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "localization_settings"`);
  }
}
