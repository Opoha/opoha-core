import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Declarative automation rule definitions.
 *
 * OWNER notes (ADR-0005 / ADR-0010):
 * - `rule_definitions` — rules module
 *
 * Plugins must not alter this table. Action handlers register via public API.
 */
export class RulesInit1722733500000 implements MigrationInterface {
  name = 'RulesInit1722733500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rule_definitions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "event_name" text NOT NULL,
        "conditions" jsonb,
        "action_refs" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "enabled" boolean NOT NULL DEFAULT true,
        "priority" integer NOT NULL DEFAULT 100,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "rule_definitions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "rule_definitions_code_uidx" UNIQUE ("code"),
        CONSTRAINT "rule_definitions_priority_check"
          CHECK ("priority" >= 0 AND "priority" <= 10000)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "rule_definitions_event_name_idx"
        ON "rule_definitions" ("event_name")
    `);
    await queryRunner.query(`
      CREATE INDEX "rule_definitions_enabled_idx"
        ON "rule_definitions" ("enabled")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "rule_definitions"`);
  }
}
