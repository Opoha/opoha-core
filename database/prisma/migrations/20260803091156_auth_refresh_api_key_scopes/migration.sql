/*
  Warnings:

  - Added the required column `key_prefix` to the `api_keys` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "key_prefix" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "api_key_permissions" (
    "api_key_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "api_key_permissions_pkey" PRIMARY KEY ("api_key_id","permission_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");

-- AddForeignKey
ALTER TABLE "api_key_permissions" ADD CONSTRAINT "api_key_permissions_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key_permissions" ADD CONSTRAINT "api_key_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
