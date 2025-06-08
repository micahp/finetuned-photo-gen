/*
  Warnings:

  - A unique constraint covering the columns `[idempotency_key]` on the table `credit_transactions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,related_entity_id,type]` on the table `credit_transactions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripe_subscription_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('earned', 'spent', 'purchased', 'subscription_renewal', 'refund', 'admin_adjustment', 'subscription_created', 'manual_adjustment');

-- CreateEnum
CREATE TYPE "RelatedEntityType" AS ENUM ('image_generation', 'image_edit', 'model_training', 'subscription', 'admin_action');

-- AlterTable
ALTER TABLE "credit_transactions" ADD COLUMN     "idempotency_key" TEXT,
ADD COLUMN     "related_edited_image_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "apiCallCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailPreferences" JSONB DEFAULT '{"marketing": true, "transactional": true, "usage_reports": false}',
ADD COLUMN     "lastApiCallAt" TIMESTAMP(3),
ADD COLUMN     "purchasedCreditPacks" JSONB DEFAULT '[]',
ADD COLUMN     "session_invalidated_at" TIMESTAMP(3),
ADD COLUMN     "stripe_current_period_end" TIMESTAMP(3),
ADD COLUMN     "stripe_price_id" TEXT,
ADD COLUMN     "stripe_subscription_id" TEXT,
ADD COLUMN     "stripe_subscription_status" TEXT,
ALTER COLUMN "credits" SET DEFAULT 10;

-- CreateTable
CREATE TABLE "edited_images" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "temporary_url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "file_size" INTEGER,
    "cloudflare_image_id" TEXT,
    "seed" INTEGER,
    "processing_time_ms" INTEGER,
    "credits_used" INTEGER NOT NULL DEFAULT 1,
    "transaction_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edited_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedStripeEvent_eventId_key" ON "ProcessedStripeEvent"("eventId");

-- CreateIndex
CREATE INDEX "ProcessedStripeEvent_eventId_idx" ON "ProcessedStripeEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_transactions_idempotency_key_key" ON "credit_transactions"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "unique_user_entity_type" ON "credit_transactions"("user_id", "related_entity_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_subscription_id_key" ON "users"("stripe_subscription_id");

-- AddForeignKey
ALTER TABLE "edited_images" ADD CONSTRAINT "edited_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
