import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Webhook event dedupe table — ownership: payment-engine.
 */
export class PaymentWebhooksInit1722695000000 implements MigrationInterface {
  name = 'PaymentWebhooksInit1722695000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payment_webhook_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "provider_code" text NOT NULL,
        "external_event_id" text NOT NULL,
        "payment_id" uuid,
        "status" text NOT NULL DEFAULT 'received',
        "action" text,
        "payload" jsonb,
        "error_message" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "processed_at" TIMESTAMPTZ,
        CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "payment_webhook_events_payment_fkey"
          FOREIGN KEY ("payment_id")
          REFERENCES "payments"("id") ON DELETE SET NULL,
        CONSTRAINT "payment_webhook_events_status_check"
          CHECK ("status" IN ('received', 'processed', 'ignored', 'failed'))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "payment_webhook_events_provider_event_uidx"
        ON "payment_webhook_events" ("provider_code", "external_event_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "payment_webhook_events_payment_id_idx"
        ON "payment_webhook_events" ("payment_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_webhook_events"`);
  }
}
