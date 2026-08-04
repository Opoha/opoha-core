import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Files metadata table — blob I/O deferred to storage plugins.
 */
export class FilesInit1722684000000 implements MigrationInterface {
  name = 'FilesInit1722684000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "files" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "storage_key" text NOT NULL,
        "mime_type" text NOT NULL,
        "size" bigint NOT NULL,
        "checksum" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_by" uuid,
        "plugin_id" text,
        "storage_provider" text,
        CONSTRAINT "files_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "files_storage_key_key" UNIQUE ("storage_key")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "files_storage_provider_idx" ON "files" ("storage_provider")
    `);
    await queryRunner.query(`
      CREATE INDEX "files_created_at_idx" ON "files" ("created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "files"`);
  }
}
