import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3 E-01 — returns / RMA header + lines with status machine.
 */
export class ReturnsInit1722707100000 implements MigrationInterface {
  name = 'ReturnsInit1722707100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "returns" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "warehouse_id" uuid NOT NULL,
        "status" text NOT NULL DEFAULT 'requested',
        "resolution" text NOT NULL,
        "reason" text,
        "notes" text,
        "payment_id" uuid,
        "replacement_order_id" uuid,
        "refund_amount_minor" bigint,
        "approved_at" TIMESTAMPTZ,
        "received_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "cancelled_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "returns_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "returns_order_fkey"
          FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE RESTRICT,
        CONSTRAINT "returns_warehouse_fkey"
          FOREIGN KEY ("warehouse_id")
          REFERENCES "warehouses"("id") ON DELETE RESTRICT,
        CONSTRAINT "returns_payment_fkey"
          FOREIGN KEY ("payment_id")
          REFERENCES "payments"("id") ON DELETE SET NULL,
        CONSTRAINT "returns_replacement_order_fkey"
          FOREIGN KEY ("replacement_order_id")
          REFERENCES "orders"("id") ON DELETE SET NULL,
        CONSTRAINT "returns_status_check"
          CHECK ("status" IN (
            'requested', 'approved', 'received',
            'refunded', 'exchanged', 'cancelled'
          )),
        CONSTRAINT "returns_resolution_check"
          CHECK ("resolution" IN ('refund', 'exchange'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "returns_order_id_idx"
        ON "returns" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "returns_warehouse_id_idx"
        ON "returns" ("warehouse_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "returns_status_idx"
        ON "returns" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "returns_created_at_idx"
        ON "returns" ("created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "return_lines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "return_id" uuid NOT NULL,
        "order_line_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "reason" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "return_lines_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "return_lines_return_fkey"
          FOREIGN KEY ("return_id")
          REFERENCES "returns"("id") ON DELETE CASCADE,
        CONSTRAINT "return_lines_order_line_fkey"
          FOREIGN KEY ("order_line_id")
          REFERENCES "order_lines"("id") ON DELETE RESTRICT,
        CONSTRAINT "return_lines_variant_fkey"
          FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id") ON DELETE RESTRICT,
        CONSTRAINT "return_lines_return_order_line_key"
          UNIQUE ("return_id", "order_line_id"),
        CONSTRAINT "return_lines_quantity_pos_check"
          CHECK ("quantity" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "return_lines_return_id_idx"
        ON "return_lines" ("return_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "return_lines_order_line_id_idx"
        ON "return_lines" ("order_line_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "return_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "returns"`);
  }
}
