import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 D-02 — manual / provider-written FX rates.
 *
 * OWNER: currency module — plugins must not alter this table.
 * Semantics: 1 from_currency_code = rate × to_currency_code.
 */
export class ExchangeRatesInit1722719200000 implements MigrationInterface {
  name = 'ExchangeRatesInit1722719200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "exchange_rates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "from_currency_code" text NOT NULL,
        "to_currency_code" text NOT NULL,
        "rate" double precision NOT NULL,
        "source" text NOT NULL DEFAULT 'manual',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "exchange_rates_from_to_key"
          UNIQUE ("from_currency_code", "to_currency_code"),
        CONSTRAINT "exchange_rates_rate_positive_chk"
          CHECK ("rate" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "exchange_rates_from_currency_idx"
        ON "exchange_rates" ("from_currency_code")
    `);
    await queryRunner.query(`
      CREATE INDEX "exchange_rates_to_currency_idx"
        ON "exchange_rates" ("to_currency_code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "exchange_rates_to_currency_idx"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "exchange_rates_from_currency_idx"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "exchange_rates"`);
  }
}
