-- Add credit rollover fields to users table
ALTER TABLE "users" ADD COLUMN "monthly_credits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "rollover_credits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "max_rollover_credits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "last_rollover_processed_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "rollover_limit_reached_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "last_credit_calculation_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "credit_calculation_hash" TEXT;

-- Update CreditTransactionType enum to add rollover types
ALTER TYPE "CreditTransactionType" ADD VALUE 'rollover_applied';
ALTER TYPE "CreditTransactionType" ADD VALUE 'rollover_expired';
ALTER TYPE "CreditTransactionType" ADD VALUE 'rollover_limit_reached';
ALTER TYPE "CreditTransactionType" ADD VALUE 'period_renewal';

-- Create CreditBalance table for detailed analytics and period tracking
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

-- Create CreditPack table to replace JSON field with proper relational structure
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

-- Add foreign key constraints
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_packs" ADD CONSTRAINT "credit_packs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for performance optimization
CREATE INDEX "credit_balances_user_id_period_start_idx" ON "credit_balances"("user_id", "period_start");
CREATE INDEX "credit_balances_user_id_created_at_idx" ON "credit_balances"("user_id", "created_at");
CREATE INDEX "credit_packs_user_id_purchased_at_idx" ON "credit_packs"("user_id", "purchased_at");

-- Performance indexes for credit queries on users table
CREATE INDEX "idx_users_credits_rollover" ON "users"("credits", "rollover_credits");
CREATE INDEX "idx_users_last_rollover" ON "users"("last_rollover_processed_at");

-- Credit transaction indexes for analytics
CREATE INDEX "idx_credit_transactions_user_type_created" ON "credit_transactions"("user_id", "type", "created_at");
CREATE INDEX "idx_credit_transactions_billing_period" ON "credit_transactions"("user_id", "created_at") 
  WHERE "type" IN ('subscription_renewal', 'rollover_applied'); 