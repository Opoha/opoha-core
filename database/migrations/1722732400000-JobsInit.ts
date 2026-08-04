import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Scheduled job definitions + run history.
 *
 * OWNER notes (ADR-0005 / ADR-0010):
 * - `job_definitions` — jobs module
 * - `job_runs` — jobs module
 *
 * Plugins must not alter these tables.
 */
export class JobsInit1722732400000 implements MigrationInterface {
  name = 'JobsInit1722732400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "job_definitions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "cron_expression" text NOT NULL,
        "timezone" text NOT NULL DEFAULT 'UTC',
        "handler_key" text NOT NULL,
        "owner_plugin_id" text,
        "enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "job_definitions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "job_definitions_code_uidx" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "job_definitions_enabled_idx" ON "job_definitions" ("enabled")
    `);

    await queryRunner.query(`
      CREATE TABLE "job_runs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "job_definition_id" uuid NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "attempt" integer NOT NULL DEFAULT 1,
        "queue_job_id" text,
        "started_at" TIMESTAMPTZ,
        "finished_at" TIMESTAMPTZ,
        "error_message" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "job_runs_definition_fkey"
          FOREIGN KEY ("job_definition_id")
          REFERENCES "job_definitions"("id") ON DELETE CASCADE,
        CONSTRAINT "job_runs_status_check"
          CHECK ("status" IN ('pending', 'running', 'succeeded', 'failed', 'canceled')),
        CONSTRAINT "job_runs_attempt_check" CHECK ("attempt" >= 1)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "job_runs_job_definition_id_idx" ON "job_runs" ("job_definition_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "job_runs_status_idx" ON "job_runs" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "job_runs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "job_definitions"`);
  }
}
