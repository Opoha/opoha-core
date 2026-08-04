import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Core coupons + automatic discount rules — ownership: promotions-engine.
 */
export class CouponsDiscountRulesInit1722700500000 implements MigrationInterface {
  name = 'CouponsDiscountRulesInit1722700500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "coupons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "kind" text NOT NULL,
        "value_bps" integer,
        "amount_minor" bigint,
        "currency_code" text,
        "min_subtotal_minor" bigint,
        "max_uses" integer,
        "max_uses_per_customer" integer,
        "usage_count" integer NOT NULL DEFAULT 0,
        "priority" integer NOT NULL DEFAULT 0,
        "starts_at" TIMESTAMPTZ,
        "ends_at" TIMESTAMPTZ,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "coupons_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "coupons_kind_check"
          CHECK ("kind" IN ('percentage', 'fixed_amount', 'free_shipping')),
        CONSTRAINT "coupons_value_bps_nonneg_check"
          CHECK ("value_bps" IS NULL OR "value_bps" >= 0),
        CONSTRAINT "coupons_amount_minor_nonneg_check"
          CHECK ("amount_minor" IS NULL OR "amount_minor" >= 0),
        CONSTRAINT "coupons_min_subtotal_nonneg_check"
          CHECK ("min_subtotal_minor" IS NULL OR "min_subtotal_minor" >= 0),
        CONSTRAINT "coupons_usage_count_nonneg_check"
          CHECK ("usage_count" >= 0),
        CONSTRAINT "coupons_max_uses_positive_check"
          CHECK ("max_uses" IS NULL OR "max_uses" > 0),
        CONSTRAINT "coupons_max_uses_per_customer_positive_check"
          CHECK ("max_uses_per_customer" IS NULL OR "max_uses_per_customer" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "coupons_code_uidx" ON "coupons" ("code")
    `);
    await queryRunner.query(`
      CREATE INDEX "coupons_active_lookup_idx"
        ON "coupons" ("is_active", "starts_at", "ends_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "discount_rules" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "kind" text NOT NULL,
        "value_bps" integer,
        "amount_minor" bigint,
        "currency_code" text,
        "min_subtotal_minor" bigint,
        "priority" integer NOT NULL DEFAULT 0,
        "stackable" boolean NOT NULL DEFAULT false,
        "starts_at" TIMESTAMPTZ,
        "ends_at" TIMESTAMPTZ,
        "is_active" boolean NOT NULL DEFAULT true,
        "conditions" jsonb,
        "metadata" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "discount_rules_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "discount_rules_kind_check"
          CHECK ("kind" IN (
            'percentage',
            'fixed_amount',
            'free_shipping',
            'bxgy',
            'automatic'
          )),
        CONSTRAINT "discount_rules_value_bps_nonneg_check"
          CHECK ("value_bps" IS NULL OR "value_bps" >= 0),
        CONSTRAINT "discount_rules_amount_minor_nonneg_check"
          CHECK ("amount_minor" IS NULL OR "amount_minor" >= 0),
        CONSTRAINT "discount_rules_min_subtotal_nonneg_check"
          CHECK ("min_subtotal_minor" IS NULL OR "min_subtotal_minor" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "discount_rules_code_uidx" ON "discount_rules" ("code")
    `);
    await queryRunner.query(`
      CREATE INDEX "discount_rules_active_priority_idx"
        ON "discount_rules" ("is_active", "priority")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "discount_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "coupons"`);
  }
}
