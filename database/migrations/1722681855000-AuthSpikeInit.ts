import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Auth spike baseline tables (users, roles, permissions, joins, api_keys, refresh_tokens).
 * Replaces the former Prisma auth_spike_init migration.
 */
export class AuthSpikeInit1722681855000 implements MigrationInterface {
  name = 'AuthSpikeInit1722681855000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" text NOT NULL,
        "password_hash" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "users_email_key" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "description" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "roles_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "roles_name_key" UNIQUE ("name")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" text NOT NULL,
        "description" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "permissions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "permissions_key_key" UNIQUE ("key")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "user_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id"),
        CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "role_id" uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id"),
        CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE,
        CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "name" text NOT NULL,
        "key_hash" text NOT NULL,
        "last_used_at" TIMESTAMPTZ,
        "revoked_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "api_keys_key_hash_key" UNIQUE ("key_hash"),
        CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token_hash" text NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "revoked_at" TIMESTAMPTZ,
        "replaced_by_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "refresh_tokens_token_hash_key" UNIQUE ("token_hash"),
        CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
