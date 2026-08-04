import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Outbound webhook endpoints + delivery attempts.
 *
 * OWNER notes (ADR-0005 / ADR-0010):
 * - `webhook_endpoints` — webhooks module
 * - `webhook_delivery_attempts` — webhooks module
 *
 * Distinct from payment inbound webhook ingress tables.
 * Plugins must not alter these tables.
 */
export class WebhooksInit1722734600000 implements MigrationInterface {
  name = 'WebhooksInit1722734600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "webhook_endpoints" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "url" text NOT NULL,
        "secret" text NOT NULL,
        "event_names" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "webhook_endpoints_code_uidx" UNIQUE ("code")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "webhook_endpoints_enabled_idx"
        ON "webhook_endpoints" ("enabled")
    `);

    await queryRunner.query(`
      CREATE TABLE "webhook_delivery_attempts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "endpoint_id" uuid NOT NULL,
        "event_name" text NOT NULL,
        "event_id" text NOT NULL,
        "payload" jsonb NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "attempt" integer NOT NULL DEFAULT 1,
        "next_attempt_at" TIMESTAMPTZ,
        "response_status" integer,
        "response_body" text,
        "error_message" text,
        "signature" text,
        "finished_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "webhook_delivery_attempts_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "webhook_delivery_attempts_endpoint_fkey"
          FOREIGN KEY ("endpoint_id")
          REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE,
        CONSTRAINT "webhook_delivery_attempts_status_check"
          CHECK ("status" IN ('pending', 'succeeded', 'failed', 'dead_letter')),
        CONSTRAINT "webhook_delivery_attempts_attempt_check"
          CHECK ("attempt" >= 1)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "webhook_delivery_attempts_endpoint_id_idx"
        ON "webhook_delivery_attempts" ("endpoint_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "webhook_delivery_attempts_status_idx"
        ON "webhook_delivery_attempts" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "webhook_delivery_attempts_next_attempt_at_idx"
        ON "webhook_delivery_attempts" ("next_attempt_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_delivery_attempts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_endpoints"`);
  }
}
