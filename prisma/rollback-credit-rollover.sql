-- Rollback: Remove Credit Rollover System
-- Date: 2025-06-27
-- Description: Safely removes credit rollover fields and tables while preserving user credit balances

BEGIN;

-- 1. Preserve current credit balances before rollback
-- Update users.credits to reflect total current balance (monthly + rollover + purchased)
UPDATE "users" 
SET "credits" = GREATEST(
    "credits",
    COALESCE("monthly_credits", 0) + COALESCE("rollover_credits", 0)
)
WHERE "monthly_credits" IS NOT NULL OR "rollover_credits" IS NOT NULL;

-- 2. Create backup of credit pack data in purchasedCreditPacks JSON field
-- Convert CreditPack records back to JSON format
UPDATE "users" 
SET "purchasedCreditPacks" = (
    SELECT COALESCE(
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'credits', cp.credits,
                'creditsUsed', cp.credits_used,
                'creditsRemaining', cp.credits_remaining,
                'amountPaid', cp.amount_paid,
                'purchasedAt', cp.purchased_at,
                'stripePaymentId', cp.stripe_payment_id,
                'metadata', cp.metadata
            )
        ),
        '[]'::json
    )
    FROM "credit_packs" cp 
    WHERE cp.user_id = "users".id
)
WHERE EXISTS (
    SELECT 1 FROM "credit_packs" cp WHERE cp.user_id = "users".id
);

-- 3. Drop foreign key constraints first
ALTER TABLE "credit_balances" DROP CONSTRAINT "credit_balances_user_id_fkey";
ALTER TABLE "credit_packs" DROP CONSTRAINT "credit_packs_user_id_fkey";

-- 4. Drop performance indexes
DROP INDEX IF EXISTS "idx_users_credits_rollover";
DROP INDEX IF EXISTS "idx_users_last_rollover";
DROP INDEX IF EXISTS "idx_credit_balances_user_period";
DROP INDEX IF EXISTS "idx_credit_balances_user_created";
DROP INDEX IF EXISTS "idx_credit_packs_user_purchased";
DROP INDEX IF EXISTS "idx_credit_transactions_user_type_created";
DROP INDEX IF EXISTS "idx_credit_transactions_billing_period";

-- 5. Drop new tables
DROP TABLE IF EXISTS "credit_packs";
DROP TABLE IF EXISTS "credit_balances";

-- 6. Remove new columns from users table
ALTER TABLE "users" DROP COLUMN IF EXISTS "monthly_credits";
ALTER TABLE "users" DROP COLUMN IF EXISTS "rollover_credits";
ALTER TABLE "users" DROP COLUMN IF EXISTS "max_rollover_credits";
ALTER TABLE "users" DROP COLUMN IF EXISTS "last_rollover_processed_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "rollover_limit_reached_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "last_credit_calculation_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "credit_calculation_hash";

-- 7. Note: Enum values cannot be easily removed without recreating the enum
-- The new transaction types will remain but won't be used
-- To fully remove: 
-- - Create new enum without rollover types
-- - Migrate data
-- - Drop old enum
-- - Rename new enum
-- This is complex and risky, so we leave enum values in place

COMMIT; 