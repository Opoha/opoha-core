import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Core payments table — ownership: payment-engine.
 */
export class PaymentsInit1722693900000 implements MigrationInterface {
  name = 'PaymentsInit1722693900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "provider_code" text NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "amount_minor" bigint NOT NULL,
        "currency_code" text NOT NULL DEFAULT 'USD',
        "external_id" text,
        "idempotency_key" text,
        "metadata" jsonb,
        "error_message" text,
        "authorized_at" TIMESTAMPTZ,
        "captured_at" TIMESTAMPTZ,
        "refunded_at" TIMESTAMPTZ,
        "failed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "payments_order_fkey"
          FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "payments_status_check"
          CHECK ("status" IN (
            'pending',
            'authorized',
            'captured',
            'refunded',
            'failed',
            'cancelled'
          )),
        CONSTRAINT "payments_amount_nonneg_check"
          CHECK ("amount_minor" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "payments_order_id_idx" ON "payments" ("order_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "payments_idempotency_key_uidx"
        ON "payments" ("idempotency_key")
        WHERE "idempotency_key" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "payments_provider_code_idx" ON "payments" ("provider_code")
    `);
    await queryRunner.query(`
      CREATE INDEX "payments_status_idx" ON "payments" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
  }
}
