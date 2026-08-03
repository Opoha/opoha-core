import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4 C-01 — gift cards header + ledger transactions.
 */
export class GiftCardsInit1722708200000 implements MigrationInterface {
  name = 'GiftCardsInit1722708200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "gift_cards" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "initial_balance_minor" bigint NOT NULL,
        "balance_minor" bigint NOT NULL,
        "currency_code" text NOT NULL,
        "issued_to_customer_id" uuid,
        "purchased_by_customer_id" uuid,
        "purchase_order_id" uuid,
        "expires_at" TIMESTAMPTZ,
        "note" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "gift_cards_code_key" UNIQUE ("code"),
        CONSTRAINT "gift_cards_issued_to_customer_fkey"
          FOREIGN KEY ("issued_to_customer_id")
          REFERENCES "customers"("id") ON DELETE SET NULL,
        CONSTRAINT "gift_cards_purchased_by_customer_fkey"
          FOREIGN KEY ("purchased_by_customer_id")
          REFERENCES "customers"("id") ON DELETE SET NULL,
        CONSTRAINT "gift_cards_purchase_order_fkey"
          FOREIGN KEY ("purchase_order_id")
          REFERENCES "orders"("id") ON DELETE SET NULL,
        CONSTRAINT "gift_cards_status_check"
          CHECK ("status" IN ('active', 'redeemed', 'disabled', 'expired')),
        CONSTRAINT "gift_cards_balance_nonneg_check"
          CHECK ("balance_minor" >= 0),
        CONSTRAINT "gift_cards_initial_balance_pos_check"
          CHECK ("initial_balance_minor" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "gift_cards_code_idx" ON "gift_cards" ("code")
    `);
    await queryRunner.query(`
      CREATE INDEX "gift_cards_status_idx" ON "gift_cards" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "gift_cards_issued_to_customer_id_idx"
        ON "gift_cards" ("issued_to_customer_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "gift_card_transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "gift_card_id" uuid NOT NULL,
        "type" text NOT NULL,
        "amount_minor" bigint NOT NULL,
        "balance_after_minor" bigint NOT NULL,
        "order_id" uuid,
        "note" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "gift_card_transactions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "gift_card_transactions_gift_card_fkey"
          FOREIGN KEY ("gift_card_id")
          REFERENCES "gift_cards"("id") ON DELETE CASCADE,
        CONSTRAINT "gift_card_transactions_order_fkey"
          FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE SET NULL,
        CONSTRAINT "gift_card_transactions_type_check"
          CHECK ("type" IN ('issue', 'purchase', 'redeem', 'adjust')),
        CONSTRAINT "gift_card_transactions_balance_after_nonneg_check"
          CHECK ("balance_after_minor" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "gift_card_transactions_gift_card_id_idx"
        ON "gift_card_transactions" ("gift_card_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "gift_card_transactions_order_id_idx"
        ON "gift_card_transactions" ("order_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "gift_card_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gift_cards"`);
  }
}
