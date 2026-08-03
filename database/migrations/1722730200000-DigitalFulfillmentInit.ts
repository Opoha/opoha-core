import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 7 D-01 — digital download tokens + license keys.
 *
 * OWNER notes (ADR-0005 / ADR-0010):
 * - `digital_download_tokens` — digital module
 * - `digital_license_keys` — digital module
 *
 * Plugins must not alter these tables.
 */
export class DigitalFulfillmentInit1722730200000
  implements MigrationInterface
{
  name = 'DigitalFulfillmentInit1722730200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "digital_download_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "token" text NOT NULL,
        "order_id" uuid NOT NULL,
        "order_line_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "customer_id" uuid,
        "asset_url" text NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "max_downloads" integer NOT NULL DEFAULT 5,
        "download_count" integer NOT NULL DEFAULT 0,
        "expires_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "digital_download_tokens_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "digital_download_tokens_token_uidx" UNIQUE ("token"),
        CONSTRAINT "digital_download_tokens_order_fkey"
          FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "digital_download_tokens_order_line_fkey"
          FOREIGN KEY ("order_line_id")
          REFERENCES "order_lines"("id") ON DELETE CASCADE,
        CONSTRAINT "digital_download_tokens_variant_fkey"
          FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id") ON DELETE RESTRICT,
        CONSTRAINT "digital_download_tokens_customer_fkey"
          FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE SET NULL,
        CONSTRAINT "digital_download_tokens_status_check"
          CHECK ("status" IN ('active', 'exhausted', 'revoked', 'expired')),
        CONSTRAINT "digital_download_tokens_max_downloads_check"
          CHECK ("max_downloads" >= 1),
        CONSTRAINT "digital_download_tokens_download_count_check"
          CHECK ("download_count" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "digital_download_tokens_order_id_idx"
        ON "digital_download_tokens" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "digital_download_tokens_customer_id_idx"
        ON "digital_download_tokens" ("customer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "digital_download_tokens_variant_id_idx"
        ON "digital_download_tokens" ("variant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "digital_download_tokens_status_idx"
        ON "digital_download_tokens" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE "digital_license_keys" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "license_key" text NOT NULL,
        "order_id" uuid NOT NULL,
        "order_line_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "customer_id" uuid,
        "status" text NOT NULL DEFAULT 'active',
        "expires_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "digital_license_keys_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "digital_license_keys_key_uidx" UNIQUE ("license_key"),
        CONSTRAINT "digital_license_keys_order_fkey"
          FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "digital_license_keys_order_line_fkey"
          FOREIGN KEY ("order_line_id")
          REFERENCES "order_lines"("id") ON DELETE CASCADE,
        CONSTRAINT "digital_license_keys_variant_fkey"
          FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id") ON DELETE RESTRICT,
        CONSTRAINT "digital_license_keys_customer_fkey"
          FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE SET NULL,
        CONSTRAINT "digital_license_keys_status_check"
          CHECK ("status" IN ('active', 'revoked', 'expired'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "digital_license_keys_order_id_idx"
        ON "digital_license_keys" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "digital_license_keys_customer_id_idx"
        ON "digital_license_keys" ("customer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "digital_license_keys_variant_id_idx"
        ON "digital_license_keys" ("variant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "digital_license_keys_status_idx"
        ON "digital_license_keys" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "digital_license_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "digital_download_tokens"`);
  }
}
