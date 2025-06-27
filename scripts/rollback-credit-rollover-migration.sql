-- ROLLBACK SCRIPT: Credit Rollover System Migration
-- This script safely rolls back the credit rollover migration while preserving user balances
-- WARNING: This should only be run if the migration needs to be reversed

-- Before running this rollback, ensure you have:
-- 1. A full database backup
-- 2. Confirmed that no critical business logic depends on the new fields
-- 3. Tested this script on a copy of production data

BEGIN;

-- Step 1: Preserve current credit balances (merge rollover into main credits)
-- This ensures no user loses credits during rollback
UPDATE users 
SET credits = credits + rollover_credits
WHERE rollover_credits > 0;

-- Step 2: Log credit consolidation transactions for audit trail
INSERT INTO credit_transactions (
    user_id,
    amount,
    type,
    description,
    balance_after,
    metadata,
    created_at
)
SELECT 
    id as user_id,
    rollover_credits as amount,
    'admin_adjustment' as type,
    'Rollover credits consolidated during migration rollback' as description,
    credits as balance_after,
    jsonb_build_object(
        'rollback_reason', 'credit_rollover_migration_reversal',
        'original_rollover_amount', rollover_credits,
        'rollback_timestamp', NOW()
    ) as metadata,
    NOW() as created_at
FROM users 
WHERE rollover_credits > 0;

-- Step 3: Drop performance indexes (in reverse order of creation)
DROP INDEX IF EXISTS "idx_credit_transactions_billing_period";
DROP INDEX IF EXISTS "idx_credit_transactions_user_type_created";
DROP INDEX IF EXISTS "idx_users_last_rollover";
DROP INDEX IF EXISTS "idx_users_credits_rollover";
DROP INDEX IF EXISTS "credit_packs_user_id_purchased_at_idx";
DROP INDEX IF EXISTS "credit_balances_user_id_created_at_idx";
DROP INDEX IF EXISTS "credit_balances_user_id_period_start_idx";

-- Step 4: Drop foreign key constraints
ALTER TABLE "credit_packs" DROP CONSTRAINT IF EXISTS "credit_packs_user_id_fkey";
ALTER TABLE "credit_balances" DROP CONSTRAINT IF EXISTS "credit_balances_user_id_fkey";

-- Step 5: Drop new tables
DROP TABLE IF EXISTS "credit_packs";
DROP TABLE IF EXISTS "credit_balances";

-- Step 6: Remove enum values (Note: PostgreSQL doesn't allow removing enum values directly)
-- We'll need to recreate the enum without the new values
-- First, update any existing transactions that use the new types
UPDATE credit_transactions 
SET type = 'admin_adjustment', 
    description = description || ' (converted from ' || type || ' during rollback)'
WHERE type IN ('rollover_applied', 'rollover_expired', 'rollover_limit_reached', 'period_renewal');

-- Create new enum without rollover types
CREATE TYPE "CreditTransactionType_new" AS ENUM (
    'earned',
    'spent', 
    'purchased',
    'subscription_renewal',
    'refund',
    'admin_adjustment',
    'subscription_created',
    'manual_adjustment'
);

-- Update the column to use the new enum
ALTER TABLE credit_transactions 
ALTER COLUMN type TYPE "CreditTransactionType_new" 
USING type::text::"CreditTransactionType_new";

-- Drop the old enum and rename the new one
DROP TYPE "CreditTransactionType";
ALTER TYPE "CreditTransactionType_new" RENAME TO "CreditTransactionType";

-- Step 7: Remove credit rollover columns from users table
ALTER TABLE "users" DROP COLUMN IF EXISTS "credit_calculation_hash";
ALTER TABLE "users" DROP COLUMN IF EXISTS "last_credit_calculation_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "rollover_limit_reached_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "last_rollover_processed_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "max_rollover_credits";
ALTER TABLE "users" DROP COLUMN IF EXISTS "rollover_credits";
ALTER TABLE "users" DROP COLUMN IF EXISTS "monthly_credits";

COMMIT;

-- Verification queries (run these after rollback to verify success)
-- SELECT COUNT(*) as total_users, SUM(credits) as total_credits FROM users;
-- SELECT COUNT(*) as total_transactions FROM credit_transactions;
-- SELECT type, COUNT(*) FROM credit_transactions GROUP BY type ORDER BY type; 