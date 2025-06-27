-- Credit Rollover System Migration Script
-- This script safely migrates existing user data to the new credit rollover system
-- 
-- IMPORTANT: This should be run AFTER the Prisma schema migration has been applied
-- This script handles the data migration and business logic setup

BEGIN;

-- Step 1: Add credit rollover fields to users table (already done by Prisma migration)
-- This section is for reference - the actual DDL is in the Prisma migration

-- Step 2: Populate monthly credits based on subscription plans
-- Map subscription plans to their monthly credit allocations
UPDATE users 
SET monthly_credits = CASE 
  WHEN subscription_plan = 'free' THEN 10
  WHEN subscription_plan = 'creator' THEN 200
  WHEN subscription_plan = 'pro' THEN 1000
  WHEN subscription_plan = 'ultra' THEN 5000
  ELSE 10 -- Default to free plan allocation
END
WHERE monthly_credits = 0; -- Only update if not already set

-- Step 3: Set max rollover credits (2x monthly allocation)
-- Free users get no rollover capability
UPDATE users 
SET max_rollover_credits = CASE 
  WHEN subscription_plan = 'free' THEN 0
  ELSE monthly_credits * 2
END;

-- Step 4: Calculate and set rollover credits based on current balance
-- Logic: If user has more credits than their monthly allocation, the excess becomes rollover
-- But cap rollover at max_rollover_credits
UPDATE users 
SET rollover_credits = CASE 
  WHEN subscription_plan = 'free' THEN 0 -- Free users get no rollover
  WHEN credits > monthly_credits THEN 
    LEAST(credits - monthly_credits, max_rollover_credits)
  ELSE 0
END;

-- Step 5: Adjust main credits to account for rollover separation
-- Main credits should not exceed monthly allocation after rollover is separated
UPDATE users 
SET credits = LEAST(credits, monthly_credits + rollover_credits)
WHERE subscription_plan != 'free';

-- Step 6: Set initial processing timestamps
UPDATE users 
SET 
  last_rollover_processed_at = CURRENT_TIMESTAMP,
  last_credit_calculation_at = CURRENT_TIMESTAMP,
  credit_calculation_hash = md5(id || credits || rollover_credits || EXTRACT(epoch FROM CURRENT_TIMESTAMP))
WHERE last_rollover_processed_at IS NULL;

-- Step 7: Create initial CreditBalance records for all active users
-- This provides a baseline for analytics and tracking
INSERT INTO credit_balances (
  id,
  user_id, 
  monthly_credits,
  rollover_credits,
  purchased_credits,
  total_credits,
  period_start,
  period_end,
  subscription_plan,
  created_at,
  metadata
)
SELECT 
  'cb_' || users.id || '_' || EXTRACT(epoch FROM CURRENT_TIMESTAMP) as id,
  users.id as user_id,
  users.monthly_credits,
  users.rollover_credits,
  COALESCE(
    (
      SELECT SUM((pack->>'credits')::int) 
      FROM jsonb_array_elements(users."purchasedCreditPacks"::jsonb) pack
      WHERE users."purchasedCreditPacks" IS NOT NULL 
      AND users."purchasedCreditPacks" != 'null'
      AND users."purchasedCreditPacks" != '[]'
    ),
    0
  ) as purchased_credits,
  users.credits as total_credits,
  COALESCE(
    users.stripe_current_period_end - INTERVAL '30 days',
    CURRENT_TIMESTAMP - INTERVAL '15 days'
  ) as period_start,
  COALESCE(
    users.stripe_current_period_end,
    CURRENT_TIMESTAMP + INTERVAL '15 days'  
  ) as period_end,
  users.subscription_plan,
  CURRENT_TIMESTAMP as created_at,
  jsonb_build_object(
    'migration_version', '1.0',
    'migration_timestamp', CURRENT_TIMESTAMP,
    'original_credits', users.credits,
    'calculated_rollover', users.rollover_credits,
    'data_source', 'initial_migration'
  ) as metadata
FROM users
WHERE subscription_status != 'cancelled'
ON CONFLICT DO NOTHING; -- Skip if record already exists

-- Step 8: Migrate purchased credit packs from JSON to relational structure
-- Only for users who have purchased credit packs
INSERT INTO credit_packs (
  id,
  user_id,
  credits,
  amount_paid,
  stripe_payment_id,
  credits_used,
  credits_remaining,
  expires_at,
  purchased_at,
  metadata
)
SELECT 
  'cp_' || users.id || '_' || gen_random_uuid() as id,
  users.id as user_id,
  (pack->>'credits')::int as credits,
  COALESCE((pack->>'amount_paid')::int, (pack->>'credits')::int * 10) as amount_paid, -- Estimate if missing
  pack->>'stripe_payment_id' as stripe_payment_id,
  COALESCE((pack->>'credits_used')::int, 0) as credits_used,
  COALESCE((pack->>'credits_remaining')::int, (pack->>'credits')::int) as credits_remaining,
  CASE 
    WHEN pack->>'expires_at' IS NOT NULL THEN (pack->>'expires_at')::timestamp
    ELSE NULL
  END as expires_at,
  COALESCE(
    (pack->>'purchased_at')::timestamp,
    CURRENT_TIMESTAMP - INTERVAL '30 days'
  ) as purchased_at,
  jsonb_build_object(
    'migrated_from_json', true,
    'migration_timestamp', CURRENT_TIMESTAMP,
    'original_data', pack
  ) as metadata
FROM users,
LATERAL jsonb_array_elements(
  CASE 
    WHEN "purchasedCreditPacks" IS NOT NULL 
    AND "purchasedCreditPacks" != 'null' 
    AND "purchasedCreditPacks" != '[]'
    THEN "purchasedCreditPacks"::jsonb
    ELSE '[]'::jsonb
  END
) pack
WHERE "purchasedCreditPacks" IS NOT NULL 
AND "purchasedCreditPacks" != 'null'
AND "purchasedCreditPacks" != '[]'
ON CONFLICT DO NOTHING;

-- Step 9: Create rollover application transactions for audit trail
-- This documents the rollover credits that were calculated during migration
INSERT INTO credit_transactions (
  id,
  user_id,
  amount,
  type,
  description,
  balance_after,
  metadata,
  created_at
)
SELECT 
  'ct_rollover_' || users.id || '_' || EXTRACT(epoch FROM CURRENT_TIMESTAMP),
  users.id,
  users.rollover_credits,
  'rollover_applied',
  'Initial rollover credits calculated during credit system migration',
  users.credits,
  jsonb_build_object(
    'migration_version', '1.0',
    'rollover_source', 'initial_calculation',
    'monthly_allocation', users.monthly_credits,
    'max_rollover_cap', users.max_rollover_credits,
    'migration_timestamp', CURRENT_TIMESTAMP
  ),
  CURRENT_TIMESTAMP
FROM users
WHERE rollover_credits > 0
ON CONFLICT DO NOTHING;

-- Step 10: Update statistics and validate data integrity
-- Create a summary of the migration for validation
DO $$
DECLARE
  total_users INTEGER;
  users_with_rollover INTEGER;
  total_rollover_credits INTEGER;
  total_credit_balances INTEGER;
  total_credit_packs INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO users_with_rollover FROM users WHERE rollover_credits > 0;
  SELECT COALESCE(SUM(rollover_credits), 0) INTO total_rollover_credits FROM users;
  SELECT COUNT(*) INTO total_credit_balances FROM credit_balances;
  SELECT COUNT(*) INTO total_credit_packs FROM credit_packs;
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Total users: %', total_users;
  RAISE NOTICE '  Users with rollover credits: %', users_with_rollover;
  RAISE NOTICE '  Total rollover credits: %', total_rollover_credits;
  RAISE NOTICE '  Credit balance records created: %', total_credit_balances;
  RAISE NOTICE '  Credit pack records created: %', total_credit_packs;
  
  -- Validation checks
  IF total_credit_balances < total_users * 0.8 THEN
    RAISE WARNING 'Low credit balance creation rate: % records for % users', total_credit_balances, total_users;
  END IF;
  
  -- Check for any users with negative credits (shouldn't happen)
  IF EXISTS (SELECT 1 FROM users WHERE credits < 0) THEN
    RAISE WARNING 'Found users with negative credits - manual review needed';
  END IF;
  
  -- Check for rollover credits exceeding caps
  IF EXISTS (SELECT 1 FROM users WHERE rollover_credits > max_rollover_credits AND max_rollover_credits > 0) THEN
    RAISE WARNING 'Found users with rollover credits exceeding their cap - manual review needed';
  END IF;
  
  RAISE NOTICE 'Migration validation completed';
END $$;

COMMIT;

-- Post-migration verification queries (run these manually to verify success)
/*
-- Query 1: Check rollover distribution by plan
SELECT 
  subscription_plan,
  COUNT(*) as user_count,
  AVG(credits) as avg_credits,
  AVG(rollover_credits) as avg_rollover,
  SUM(rollover_credits) as total_rollover
FROM users 
GROUP BY subscription_plan
ORDER BY subscription_plan;

-- Query 2: Verify credit balance records
SELECT 
  subscription_plan,
  COUNT(*) as balance_records,
  AVG(total_credits) as avg_total_credits,
  AVG(rollover_credits) as avg_rollover
FROM credit_balances cb
JOIN users u ON cb.user_id = u.id
GROUP BY subscription_plan;

-- Query 3: Check credit pack migration
SELECT 
  COUNT(*) as total_packs,
  SUM(credits) as total_pack_credits,
  AVG(amount_paid) as avg_amount_paid
FROM credit_packs;

-- Query 4: Validate no negative credits
SELECT COUNT(*) as users_with_negative_credits 
FROM users 
WHERE credits < 0;

-- Query 5: Check rollover cap violations
SELECT COUNT(*) as rollover_cap_violations
FROM users 
WHERE rollover_credits > max_rollover_credits 
AND max_rollover_credits > 0;
*/ 