import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Customers, addresses, groups, and memberships.
 */
export class CustomersInit1722690600000 implements MigrationInterface {
  name = 'CustomersInit1722690600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "customers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" text NOT NULL,
        "password_hash" text NOT NULL,
        "first_name" text,
        "last_name" text,
        "phone" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "customers_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "customers_email_key" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "customers_created_at_idx"
        ON "customers" ("created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "customer_addresses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "customer_id" uuid NOT NULL,
        "label" text,
        "first_name" text NOT NULL,
        "last_name" text NOT NULL,
        "company" text,
        "line1" text NOT NULL,
        "line2" text,
        "city" text NOT NULL,
        "province" text,
        "postal_code" text NOT NULL,
        "country_code" text NOT NULL,
        "phone" text,
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "customer_addresses_customer_fkey"
          FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "customer_addresses_customer_id_idx"
        ON "customer_addresses" ("customer_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "customer_groups" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "description" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "customer_groups_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "customer_groups_name_key" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "customer_group_memberships" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "customer_id" uuid NOT NULL,
        "group_id" uuid NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "customer_group_memberships_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "customer_group_memberships_customer_group_key"
          UNIQUE ("customer_id", "group_id"),
        CONSTRAINT "customer_group_memberships_customer_fkey"
          FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE CASCADE,
        CONSTRAINT "customer_group_memberships_group_fkey"
          FOREIGN KEY ("group_id")
          REFERENCES "customer_groups"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "customer_group_memberships_group_id_idx"
        ON "customer_group_memberships" ("group_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_group_memberships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_groups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_addresses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customers"`);
  }
}
