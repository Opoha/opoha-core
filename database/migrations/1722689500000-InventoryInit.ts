import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inventory items, reservations, and adjustments (Phase 1 B-01/B-02).
 */
export class InventoryInit1722689500000 implements MigrationInterface {
  name = 'InventoryInit1722689500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "inventory_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "variant_id" uuid NOT NULL,
        "quantity_on_hand" integer NOT NULL DEFAULT 0,
        "quantity_reserved" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "inventory_items_variant_id_key" UNIQUE ("variant_id"),
        CONSTRAINT "inventory_items_variant_fkey"
          FOREIGN KEY ("variant_id")
          REFERENCES "product_variants"("id") ON DELETE CASCADE,
        CONSTRAINT "inventory_items_on_hand_nonneg_check"
          CHECK ("quantity_on_hand" >= 0),
        CONSTRAINT "inventory_items_reserved_nonneg_check"
          CHECK ("quantity_reserved" >= 0),
        CONSTRAINT "inventory_items_reserved_lte_on_hand_check"
          CHECK ("quantity_reserved" <= "quantity_on_hand")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "inventory_items_created_at_idx"
        ON "inventory_items" ("created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "inventory_reservations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "inventory_item_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "reference" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "inventory_reservations_item_fkey"
          FOREIGN KEY ("inventory_item_id")
          REFERENCES "inventory_items"("id") ON DELETE CASCADE,
        CONSTRAINT "inventory_reservations_quantity_pos_check"
          CHECK ("quantity" > 0),
        CONSTRAINT "inventory_reservations_status_check"
          CHECK ("status" IN ('active', 'released', 'committed'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "inventory_reservations_item_id_idx"
        ON "inventory_reservations" ("inventory_item_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "inventory_reservations_status_idx"
        ON "inventory_reservations" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE "inventory_adjustments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "inventory_item_id" uuid NOT NULL,
        "delta" integer NOT NULL,
        "reason" text,
        "quantity_on_hand_after" integer NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "inventory_adjustments_item_fkey"
          FOREIGN KEY ("inventory_item_id")
          REFERENCES "inventory_items"("id") ON DELETE CASCADE,
        CONSTRAINT "inventory_adjustments_delta_nonzero_check"
          CHECK ("delta" <> 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "inventory_adjustments_item_id_idx"
        ON "inventory_adjustments" ("inventory_item_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_adjustments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_reservations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_items"`);
  }
}
