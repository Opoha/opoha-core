import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4 E-01 — customer segments (rule-based membership for promotions).
 */
export class SegmentsInit1722711500000 implements MigrationInterface {
  name = 'SegmentsInit1722711500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "customer_segments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "rules" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "customer_segments_code_key" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "customer_segments_is_active_idx"
        ON "customer_segments" ("is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_segments"`);
  }
}
