import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Loyalty accounts + ledger transactions.
 */
export class LoyaltyInit1722709300000 implements MigrationInterface {
  name = 'LoyaltyInit1722709300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "loyalty_accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "customer_id" uuid NOT NULL,
        "points_balance" integer NOT NULL DEFAULT 0,
        "lifetime_points_earned" integer NOT NULL DEFAULT 0,
        "lifetime_points_redeemed" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "loyalty_accounts_customer_id_key" UNIQUE ("customer_id"),
        CONSTRAINT "loyalty_accounts_customer_fkey"
          FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE CASCADE,
        CONSTRAINT "loyalty_accounts_points_balance_nonneg_check"
          CHECK ("points_balance" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "loyalty_accounts_customer_id_idx"
        ON "loyalty_accounts" ("customer_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "loyalty_transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "account_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "type" text NOT NULL,
        "points" integer NOT NULL,
        "balance_after" integer NOT NULL,
        "order_id" uuid,
        "note" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "loyalty_transactions_account_fkey"
          FOREIGN KEY ("account_id")
          REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE,
        CONSTRAINT "loyalty_transactions_order_fkey"
          FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE SET NULL,
        CONSTRAINT "loyalty_transactions_type_check"
          CHECK ("type" IN ('accrue', 'redeem', 'adjust')),
        CONSTRAINT "loyalty_transactions_balance_after_nonneg_check"
          CHECK ("balance_after" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "loyalty_transactions_account_id_idx"
        ON "loyalty_transactions" ("account_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "loyalty_transactions_customer_id_idx"
        ON "loyalty_transactions" ("customer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "loyalty_transactions_order_id_idx"
        ON "loyalty_transactions" ("order_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "loyalty_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "loyalty_accounts"`);
  }
}
