import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Durable plugin enable flag + opaque config JSON for admin management.
 */
export class PluginStatesInit1722685100000 implements MigrationInterface {
  name = 'PluginStatesInit1722685100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "plugin_states" (
        "plugin_id" text NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "config_json" text,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "plugin_states_pkey" PRIMARY KEY ("plugin_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "plugin_states_enabled_idx" ON "plugin_states" ("enabled")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "plugin_states"`);
  }
}
