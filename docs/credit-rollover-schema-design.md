# Credit Rollover System - Database Schema Design

## Overview
This document outlines the database schema changes required to implement a competitive credit rollover system that allows users to accumulate unused credits up to 2x their monthly allocation.

## Current State Analysis

### Existing User Credit Fields
```prisma
model User {
  credits                  Int                 @default(10)  // Current total credit balance
  stripeCurrentPeriodEnd   DateTime?           // When current billing period ends
  subscriptionPlan         String?             // Plan type (free, creator, pro, ultra)
  purchasedCreditPacks     Json?               @default("[]") // One-time credit purchases
}
```

### Existing Credit Transaction System
- ✅ `CreditTransaction` model exists with idempotency and transaction tracking
- ✅ Supports types: earned, spent, purchased, subscription_renewal, etc.
- ✅ Tracks balance snapshots after each transaction

## Proposed Schema Changes

### 1. Enhanced User Model for Credit Rollover

**New Fields to Add:**
```prisma
model User {
  // Existing fields...
  credits                  Int                 @default(10)
  
  // NEW: Credit Rollover Fields
  monthlyCredits           Int                 @default(0)      // Base monthly allocation from plan
  rolloverCredits          Int                 @default(0)      // Credits accumulated from previous periods
  maxRolloverCredits       Int                 @default(0)      // Maximum rollover allowed (2x monthly)
  lastRolloverProcessedAt  DateTime?           // When rollover was last calculated
  rolloverLimitReachedAt   DateTime?           // When user first hit rollover cap
  
  // Enhanced for better performance (reduce session query load)
  lastCreditCalculationAt  DateTime?           // Cache timestamp for credit calculations
  creditCalculationHash    String?             // Hash to validate if recalculation needed
}
```

### 2. New Credit Balance History Model

Track detailed credit breakdown for analytics and transparency:

```prisma
model CreditBalance {
  id                    String    @id @default(cuid())
  userId                String    @map("user_id")
  
  // Credit breakdown
  monthlyCredits        Int       // Credits from current subscription period
  rolloverCredits       Int       // Credits rolled over from previous periods
  purchasedCredits      Int       // Credits from one-time purchases
  totalCredits          Int       // Sum of above three types
  
  // Period tracking
  periodStart           DateTime  // Start of billing period
  periodEnd             DateTime  // End of billing period
  subscriptionPlan      String?   // Plan active during this period
  
  // Metadata
  createdAt             DateTime  @default(now()) @map("created_at")
  metadata              Json?     // Additional tracking data
  
  // Relations
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("credit_balances")
  @@index([userId, periodStart])
  @@index([userId, createdAt])
}
```

### 3. Enhanced Credit Transaction Types

**Add new transaction types:**
```prisma
enum CreditTransactionType {
  // Existing...
  earned
  spent
  purchased
  subscription_renewal
  refund
  admin_adjustment
  subscription_created
  manual_adjustment
  
  // NEW: Rollover types
  rollover_applied        // Credits rolled over from previous period
  rollover_expired        // Credits that exceeded rollover cap
  rollover_limit_reached  // When user hits rollover maximum
  period_renewal          // New billing period started
}
```

### 4. Credit Pack Purchase Model

Separate credit packs from the JSON field for better querying and analytics:

```prisma
model CreditPack {
  id                String    @id @default(cuid())
  userId            String    @map("user_id")
  
  // Purchase details
  credits           Int       // Number of credits in pack
  amountPaid        Int       // Amount paid in cents
  stripePaymentId   String?   @map("stripe_payment_id")
  
  // Usage tracking
  creditsUsed       Int       @default(0) @map("credits_used")
  creditsRemaining  Int       // Calculated field or computed
  
  // Expiration (optional for future use)
  expiresAt         DateTime? @map("expires_at")
  
  // Metadata
  purchasedAt       DateTime  @default(now()) @map("purchased_at")
  metadata          Json?
  
  // Relations
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("credit_packs")
  @@index([userId, purchasedAt])
}
```

## Migration Strategy

### Phase 1: Add New Fields (Non-Breaking)
1. Add new fields to User model with safe defaults
2. Create new CreditBalance and CreditPack models
3. Update CreditTransactionType enum

### Phase 2: Data Migration
1. Populate `monthlyCredits` from subscription plans
2. Calculate initial `rolloverCredits` based on current balance vs plan
3. Migrate existing `purchasedCreditPacks` JSON to CreditPack records
4. Create initial CreditBalance records for active users

### Phase 3: Logic Implementation
1. Update credit allocation logic in Stripe webhooks
2. Implement rollover calculation cron job
3. Update credit spending logic to consume in correct order
4. Add analytics and reporting

## Credit Consumption Order

**Priority order for spending credits:**
1. **Purchased Credits** (oldest first) - Use one-time purchases first
2. **Current Period Credits** - Use current subscription allocation
3. **Rollover Credits** (oldest first) - Use rolled-over credits last

This prioritizes purchased credits and encourages subscription renewals.

## Performance Optimizations

### Database Indexes
```sql
-- User table indexes for credit queries
CREATE INDEX idx_users_credits_rollover ON users(credits, rollover_credits);
CREATE INDEX idx_users_last_rollover ON users(last_rollover_processed_at);

-- Credit transaction indexes for analytics
CREATE INDEX idx_credit_transactions_user_type_created ON credit_transactions(user_id, type, created_at);
CREATE INDEX idx_credit_transactions_billing_period ON credit_transactions(user_id, created_at) 
  WHERE type IN ('subscription_renewal', 'rollover_applied');

-- Credit balance indexes
CREATE INDEX idx_credit_balances_user_period ON credit_balances(user_id, period_start, period_end);
```

### Caching Strategy
- Cache user credit calculations with `lastCreditCalculationAt` timestamp
- Use Redis for frequently accessed credit balances
- Implement credit balance snapshots at period boundaries

## Rollover Business Logic

### Rules
1. **Rollover Cap**: Maximum rollover = 2× monthly subscription credits
2. **Rollover Timing**: Process rollover at subscription renewal
3. **Expiration**: Rollover credits expire after 12 months (future enhancement)
4. **Free Plan**: No rollover (monthly credits reset to base allocation)

### Calculation Example
```javascript
// User has Pro plan (1000 monthly credits)
const monthlyCredits = 1000;
const maxRollover = monthlyCredits * 2; // 2000 credits max rollover

// At period end, user has 1200 credits remaining
const currentBalance = 1200;
const rolloverAmount = Math.min(currentBalance, maxRollover); // 1200 credits

// Next period: 1000 (new monthly) + 1200 (rollover) = 2200 total credits
```

## Compatibility with Video Pricing

The schema supports the reduced video costs (8-25 credits/second vs current 18-55):

- Higher credit allocations accommodate video generation costs
- Rollover system provides buffer for expensive video operations
- Analytics track video vs image usage patterns
- Credit packs allow users to buy additional credits for video projects

## Testing Requirements

### Schema Tests
- [ ] Verify migration scripts apply cleanly
- [ ] Test rollover calculations with various scenarios
- [ ] Validate foreign key constraints and cascades
- [ ] Test credit consumption order logic

### Performance Tests
- [ ] Benchmark credit balance queries with large datasets
- [ ] Test concurrent credit spending transactions
- [ ] Validate index performance on critical queries

### Business Logic Tests
- [ ] Test rollover cap enforcement
- [ ] Verify credit expiration logic
- [ ] Test edge cases (plan changes, subscription cancellations)

## Security Considerations

1. **Transaction Integrity**: All credit operations must be atomic
2. **Idempotency**: Prevent duplicate credit allocations during rollover
3. **Audit Trail**: Maintain complete transaction history
4. **Rate Limiting**: Prevent credit farming through rapid operations

## Implementation Phases

### Phase 1: Schema Foundation (Week 1)
- Create migration scripts
- Add new models and fields
- Update existing enums

### Phase 2: Data Migration (Week 2)
- Migrate existing credit data
- Populate rollover calculations
- Validate data integrity

### Phase 3: Business Logic (Week 3-4)
- Implement rollover calculation service
- Update credit spending logic
- Add Stripe webhook integration

### Phase 4: UI & Analytics (Week 5-6)
- Update credit display components
- Add rollover analytics dashboard
- Implement user notifications

---

This schema design provides a robust foundation for the credit rollover system while maintaining backward compatibility and supporting the transition to video generation pricing. 