-- Migration: Add Credit Rollover System
-- Date: 2025-06-27
-- Description: Adds credit rollover fields to User model and creates new CreditBalance and CreditPack models

BEGIN;

-- 1. Add new credit rollover fields to users table
ALTER TABLE "users" ADD COLUMN "monthly_credits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "rollover_credits" INTEGER NOT NULL DEFAULT 0;  
ALTER TABLE "users" ADD COLUMN "max_rollover_credits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "last_rollover_processed_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "rollover_limit_reached_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "last_credit_calculation_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "credit_calculation_hash" TEXT;

-- 2. Create credit_balances table for period-based tracking
CREATE TABLE "credit_balances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "monthly_credits" INTEGER NOT NULL,
    "rollover_credits" INTEGER NOT NULL,
    "purchased_credits" INTEGER NOT NULL,
    "total_credits" INTEGER NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "subscription_plan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "credit_balances_pkey" PRIMARY KEY ("id")
);

-- 3. Create credit_packs table for one-time purchases
CREATE TABLE "credit_packs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amount_paid" INTEGER NOT NULL,
    "stripe_payment_id" TEXT,
    "credits_used" INTEGER NOT NULL DEFAULT 0,
    "credits_remaining" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3),
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "credit_packs_pkey" PRIMARY KEY ("id")
);

-- 4. Update CreditTransactionType enum to include rollover types
-- Note: Prisma will handle enum updates in the generated migration
-- ALTER TYPE "CreditTransactionType" ADD VALUE 'rollover_applied';
-- ALTER TYPE "CreditTransactionType" ADD VALUE 'rollover_expired'; 
-- ALTER TYPE "CreditTransactionType" ADD VALUE 'rollover_limit_reached';
-- ALTER TYPE "CreditTransactionType" ADD VALUE 'period_renewal';

-- 5. Update RelatedEntityType enum to include video generation
-- ALTER TYPE "RelatedEntityType" ADD VALUE 'video_generation';

-- 6. Create foreign key constraints
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "credit_packs" ADD CONSTRAINT "credit_packs_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Create performance indexes for credit operations
CREATE INDEX "idx_users_credits_rollover" ON "users"("credits", "rollover_credits");
CREATE INDEX "idx_users_last_rollover" ON "users"("last_rollover_processed_at");

CREATE INDEX "idx_credit_balances_user_period" ON "credit_balances"("user_id", "period_start");
CREATE INDEX "idx_credit_balances_user_created" ON "credit_balances"("user_id", "created_at");

CREATE INDEX "idx_credit_packs_user_purchased" ON "credit_packs"("user_id", "purchased_at");

CREATE INDEX "idx_credit_transactions_user_type_created" ON "credit_transactions"("user_id", "type", "created_at");
CREATE INDEX "idx_credit_transactions_billing_period" ON "credit_transactions"("user_id", "created_at") 
    WHERE "type" IN ('subscription_renewal', 'rollover_applied');

-- 8. Data migration: Populate monthly_credits from subscription plans
UPDATE "users" 
SET "monthly_credits" = CASE 
    WHEN "subscription_plan" = 'free' THEN 10
    WHEN "subscription_plan" = 'creator' THEN 200  
    WHEN "subscription_plan" = 'pro' THEN 1000
    WHEN "subscription_plan" = 'ultra' THEN 5000
    ELSE 10  -- Default for any unknown plans
END;

-- 9. Calculate max_rollover_credits (2x monthly allocation)
UPDATE "users" 
SET "max_rollover_credits" = "monthly_credits" * 2;

-- 10. Initialize rollover_credits based on current balance vs monthly allocation
-- Users with more credits than their plan allocation get the excess as rollover credits
UPDATE "users" 
SET "rollover_credits" = GREATEST(0, "credits" - "monthly_credits")
WHERE "credits" > "monthly_credits";

-- 11. Adjust current credits to not exceed monthly + rollover
UPDATE "users" 
SET "credits" = LEAST("credits", "monthly_credits" + "max_rollover_credits");

-- 12. Create initial credit balance records for active subscription users
INSERT INTO "credit_balances" (
    "id",
    "user_id", 
    "monthly_credits",
    "rollover_credits", 
    "purchased_credits",
    "total_credits",
    "period_start",
    "period_end", 
    "subscription_plan",
    "metadata"
)
SELECT 
    CONCAT('init_', "users"."id") as "id",
    "users"."id" as "user_id",
    "users"."monthly_credits",
    "users"."rollover_credits",
    0 as "purchased_credits", -- Will be migrated separately
    "users"."credits" as "total_credits",
    COALESCE("subscriptions"."current_period_start", "users"."created_at") as "period_start",
    COALESCE("subscriptions"."current_period_end", "users"."created_at" + INTERVAL '1 month') as "period_end",
    "users"."subscription_plan",
    JSON_BUILD_OBJECT(
        'migration_type', 'initial_balance',
        'migrated_at', NOW(),
        'original_credits', "users"."credits"
    ) as "metadata"
FROM "users" 
LEFT JOIN "subscriptions" ON "users"."id" = "subscriptions"."user_id" 
    AND "subscriptions"."status" = 'active'
WHERE "users"."subscription_status" != 'free' 
   OR "users"."credits" > 10; -- Include free users with purchased credits

COMMIT; 