import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Core tax classes + jurisdiction rules — ownership: tax-engine.
 */
export class TaxClassesRulesInit1722697200000 implements MigrationInterface {
  name = 'TaxClassesRulesInit1722697200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tax_classes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "tax_classes_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "tax_classes_code_uidx" ON "tax_classes" ("code")
    `);

    await queryRunner.query(`
      CREATE TABLE "tax_rules" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tax_class_id" uuid NOT NULL,
        "name" text NOT NULL,
        "country_code" text NOT NULL,
        "province" text,
        "postal_code" text,
        "rate_bps" integer NOT NULL,
        "priority" integer NOT NULL DEFAULT 0,
        "applies_to_shipping" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "tax_rules_tax_class_fkey"
          FOREIGN KEY ("tax_class_id")
          REFERENCES "tax_classes"("id") ON DELETE CASCADE,
        CONSTRAINT "tax_rules_rate_bps_nonneg_check"
          CHECK ("rate_bps" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "tax_rules_tax_class_id_idx" ON "tax_rules" ("tax_class_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "tax_rules_country_code_idx" ON "tax_rules" ("country_code")
    `);
    await queryRunner.query(`
      CREATE INDEX "tax_rules_active_lookup_idx"
        ON "tax_rules" ("tax_class_id", "country_code", "is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tax_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tax_classes"`);
  }
}
