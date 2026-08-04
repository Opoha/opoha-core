import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Subscription plans + customer subscription schedule state.
 *
 * OWNER notes (ADR-0005 / ADR-0010):
 * - `subscription_plans` — subscriptions module
 * - `subscriptions` — subscriptions module
 *
 * Plugins must not alter these tables.
 */
export class SubscriptionsInit1722731300000 implements MigrationInterface {
  name = 'SubscriptionsInit1722731300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subscription_plans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "price_minor" bigint NOT NULL,
        "currency_code" text NOT NULL DEFAULT 'USD',
        "billing_interval_unit" text NOT NULL DEFAULT 'month',
        "billing_interval_count" integer NOT NULL DEFAULT 1,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "subscription_plans_code_uidx" UNIQUE ("code"),
        CONSTRAINT "subscription_plans_price_minor_check" CHECK ("price_minor" >= 0),
        CONSTRAINT "subscription_plans_interval_count_check" CHECK ("billing_interval_count" >= 1),
        CONSTRAINT "subscription_plans_interval_unit_check"
          CHECK ("billing_interval_unit" IN ('day', 'week', 'month', 'year'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plan_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "store_id" uuid,
        "status" text NOT NULL DEFAULT 'active',
        "payment_provider_code" text NOT NULL DEFAULT 'manual',
        "current_period_start" TIMESTAMPTZ NOT NULL,
        "current_period_end" TIMESTAMPTZ NOT NULL,
        "next_billing_at" TIMESTAMPTZ NOT NULL,
        "canceled_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "subscriptions_plan_fkey"
          FOREIGN KEY ("plan_id")
          REFERENCES "subscription_plans"("id") ON DELETE RESTRICT,
        CONSTRAINT "subscriptions_customer_fkey"
          FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE CASCADE,
        CONSTRAINT "subscriptions_store_fkey"
          FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE SET NULL,
        CONSTRAINT "subscriptions_status_check"
          CHECK ("status" IN ('active', 'paused', 'canceled', 'past_due', 'expired'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "subscriptions_customer_id_idx" ON "subscriptions" ("customer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions" ("plan_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "subscriptions_next_billing_at_idx" ON "subscriptions" ("next_billing_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "subscriptions_status_idx" ON "subscriptions" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_plans"`);
  }
}
