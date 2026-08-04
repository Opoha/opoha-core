import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Append-only audit_logs table for auth, user, role, and API key events.
 */
export class AuditLogsInit1722682800000 implements MigrationInterface {
  name = 'AuditLogsInit1722682800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "actor_user_id" uuid,
        "action" text NOT NULL,
        "resource_type" text,
        "resource_id" text,
        "metadata" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs" ("actor_user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "audit_logs_action_idx" ON "audit_logs" ("action")
    `);
    await queryRunner.query(`
      CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
  }
}
