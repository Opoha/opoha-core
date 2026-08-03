import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 F-01 — B2B company accounts + buyer memberships.
 *
 * OWNER: b2b module — plugins must not alter these tables.
 * Cross-module FKs to `stores.id` and `customers.id` (ADR-0005 / ADR-0010).
 */
export class B2bCompaniesInit1722721400000 implements MigrationInterface {
  name = 'B2bCompaniesInit1722721400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "companies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "store_id" uuid NOT NULL,
        "name" text NOT NULL,
        "credit_limit_minor" bigint,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "companies_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "companies_store_id_fkey"
          FOREIGN KEY ("store_id")
          REFERENCES "stores"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "companies_store_id_idx" ON "companies" ("store_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "company_memberships" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "role" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "company_memberships_company_customer_key"
          UNIQUE ("company_id", "customer_id"),
        CONSTRAINT "company_memberships_company_id_fkey"
          FOREIGN KEY ("company_id")
          REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "company_memberships_customer_id_fkey"
          FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE CASCADE,
        CONSTRAINT "company_memberships_role_check"
          CHECK ("role" IN ('buyer', 'approver', 'admin'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "company_memberships_customer_id_idx"
        ON "company_memberships" ("customer_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "company_memberships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "companies"`);
  }
}
