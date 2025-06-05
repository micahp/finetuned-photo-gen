import { prisma } from '@/lib/db'
import { PRICING_PLANS, getCurrentPlan } from '@/lib/stripe/pricing'

export type CreditTransactionType = 
  | 'earned' 
  | 'spent' 
  | 'purchased' 
  | 'subscription_renewal' 
  | 'refund'
  | 'admin_adjustment'

export type RelatedEntityType = 
  | 'image_generation' 
  | 'model_training' 
  | 'subscription' 
  | 'admin_action'

export interface CreditTransactionData {
  userId: string
  amount: number
  type: CreditTransactionType
  description: string
  relatedEntityType?: RelatedEntityType
  relatedEntityId?: string
  metadata?: Record<string, any>
  stripeEventId?: string;
}

export interface UsageAnalytics {
  currentPeriod: {
    creditsUsed: number
    creditsRemaining: number
    imagesGenerated: number
    modelsCreated: number
    percentageUsed: number
  }
  allTime: {
    totalCreditsUsed: number
    totalCreditsEarned: number
    totalImagesGenerated: number
    totalModelsCreated: number
    totalSpent: number
  }
  recentTransactions: Array<{
    id: string
    amount: number
    type: CreditTransactionType
    description: string
    createdAt: Date
    balanceAfter: number
  }>
  usageTrends: Array<{
    date: string
    creditsUsed: number
    imagesGenerated: number
  }>
}

export interface UsageLimits {
  maxCreditsPerMonth: number
  maxModels: number
  currentCredits: number
  currentModels: number
  canCreateModel: boolean
  canGenerateImage: boolean
  warningThreshold: number
  isNearLimit: boolean
}

export class CreditService {
  /**
   * Record a credit transaction with automatic balance calculation
   */
  static async recordTransaction(data: CreditTransactionData): Promise<{
    success: boolean;
    newBalance?: number;
    transactionId?: string;
    error?: string;
    alreadyProcessed?: boolean;
  }> {
    try {
      let finalBalance = 0;
      let transactionResult: { id: string; balanceAfter: number } | null = null;
      let wasAlreadyProcessed = false;

      await prisma.$transaction(async (tx) => {
        if (data.stripeEventId) {
          const existingEvent = await tx.processedStripeEvent.findUnique({
            where: { eventId: data.stripeEventId },
          });

          if (existingEvent) {
            console.log(
              `Stripe event ${data.stripeEventId} already processed. Skipping transaction.`,
            );
            wasAlreadyProcessed = true;
            // Fetch current balance to return accurately
            const user = await tx.user.findUnique({
              where: { id: data.userId },
              select: { credits: true },
            });
            finalBalance = user?.credits ?? 0; // Fallback to 0 if user not found, though unlikely here
            // No transactionResult will be set, so it remains null
            return; // Exit the transaction block early
          }
        }

        // If not already processed, or no stripeEventId, proceed with transaction
        const updatedUser = await tx.user.update({
          where: { id: data.userId },
          data: { credits: { increment: data.amount } },
          select: { credits: true },
        });

        finalBalance = updatedUser.credits;

        const createdTx = await tx.creditTransaction.create({
          data: {
            userId: data.userId,
            amount: data.amount,
            type: data.type,
            description: data.description,
            relatedEntityType: data.relatedEntityType,
            relatedEntityId: data.relatedEntityId,
            balanceAfter: finalBalance,
            metadata: data.metadata,
            // stripeEventId is not directly stored on CreditTransaction model, but on ProcessedStripeEvent
          },
          select: { id: true },
        });

        if (data.stripeEventId && !wasAlreadyProcessed) {
          await tx.processedStripeEvent.create({
            data: { eventId: data.stripeEventId },
          });
        }

        transactionResult = { id: createdTx.id, balanceAfter: finalBalance };
      });

      if (wasAlreadyProcessed) {
        return {
          success: true,
          alreadyProcessed: true,
          newBalance: finalBalance, // Balance after confirming it was a duplicate
        };
      }

      if (transactionResult) {
        return {
          success: true,
          newBalance: transactionResult.balanceAfter,
          transactionId: transactionResult.id,
        };
      } else {
        // This case might be reached if wasAlreadyProcessed is true AND something went wrong fetching balance
        // or if transaction genuinely failed before setting transactionResult, outside of wasAlreadyProcessed logic
        return { 
          success: false, 
          error: 'Transaction did not complete as expected.', 
          newBalance: finalBalance // finalBalance might be from pre-duplicate check or initial value
        };
      }
    } catch (error: any) {
      console.error('Error in recordTransaction:', error);
      // If the error is due to a unique constraint violation on ProcessedStripeEvent (e.g., race condition if not handled by above check)
      // This might be overly specific here, as the check above should prevent it.
      // However, if a race condition bypasses the initial check and hits the DB constraint on ProcessedStripeEvent,
      // it would be good to handle it as 'alreadyProcessed'. Prisma specific error code for unique constraint is P2002.
      if (error.code === 'P2002' && data.stripeEventId && error.meta?.target?.includes('eventId')) {
        console.warn(`Race condition handled for Stripe event ${data.stripeEventId}. Event already processed.`);
        // Attempt to fetch current balance to return accurately
        try {
            const user = await prisma.user.findUnique({
                where: { id: data.userId },
                select: { credits: true },
            });
            return {
                success: true,
                alreadyProcessed: true,
                newBalance: user?.credits ?? 0,
            };
        } catch (fetchError) {
            console.error('Failed to fetch user balance after race condition handling:', fetchError);
            return { success: true, alreadyProcessed: true, newBalance: 0 }; // Fallback
        }
      }
      return {
        success: false,
        error: `Failed to record transaction: ${error.message || 'Unknown error'}`,
      };
    }
  }

  /**
   * Spend credits for an operation (e.g., image generation)
   */
  static async spendCredits(
    userId: string, 
    amount: number, 
    description: string,
    relatedEntityType?: RelatedEntityType,
    relatedEntityId?: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    let userCreditsBeforeSpend = 0;
    try {
      // Check if user has enough credits
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true }
      });

      if (!user) {
        return { success: false, newBalance: 0, error: 'User not found' };
      }
      userCreditsBeforeSpend = user.credits;

      if (user.credits < amount) {
        return { 
          success: false, 
          newBalance: user.credits, 
          error: `Insufficient credits. Required: ${amount}, Available: ${user.credits}` 
        };
      }

      // Record the transaction
      const transactionResult = await this.recordTransaction({
        userId,
        amount: -amount, // Negative for spending
        type: 'spent',
        description,
        relatedEntityType,
        relatedEntityId,
        metadata
      });

      if (!transactionResult.success) {
        // If recordTransaction handled an error and returned success: false
        return {
          success: false,
          newBalance: userCreditsBeforeSpend, // Balance remains what it was before attempting to spend
          error: transactionResult.error || 'Failed to process credit transaction (recordTransaction failed)',
        };
      }

      // If recordTransaction was successful
      return { success: true, newBalance: transactionResult.newBalance! }; // newBalance from successful recordTransaction
    } catch (error) {
      // This catch block handles errors like prisma.user.findUnique failing, or if recordTransaction throws an unexpected error
      console.error('Error spending credits:', error);
      return { 
        success: false, 
        newBalance: userCreditsBeforeSpend, // Or 0 if user was not even found
        error: 'Failed to process credit transaction (unexpected error)' 
      };
    }
  }

  /**
   * Add credits to user account
   */
  static async addCredits(
    userId: string,
    amount: number,
    type: CreditTransactionType,
    description: string,
    relatedEntityType?: RelatedEntityType,
    relatedEntityId?: string,
    metadata?: Record<string, any>,
    stripeEventId?: string,
  ): Promise<{ success: boolean; newBalance: number; error?: string; alreadyProcessed?: boolean }> {
    try {
      const transactionResult = await this.recordTransaction({
        userId,
        amount,
        type,
        description,
        relatedEntityType,
        relatedEntityId,
        metadata,
        stripeEventId,
      });

      if (!transactionResult.success) {
        // If recordTransaction handled an error and returned success: false
        return {
          success: false,
          newBalance: (await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } }))?.credits || 0,
          error: transactionResult.error || 'Failed to add credits (recordTransaction failed)',
          alreadyProcessed: transactionResult.alreadyProcessed,
        };
      }
      
      // If recordTransaction was successful
      return { 
        success: true, 
        newBalance: transactionResult.newBalance!,
        alreadyProcessed: transactionResult.alreadyProcessed
      }; 

    } catch (error) {
      console.error('Error adding credits:', error);
      let currentBalance = 0;
      try {
        const userOnError = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true }});
        if (userOnError) currentBalance = userOnError.credits;
      } catch (e) { /* ignore error during error handling */ }

      return { 
        success: false, 
        newBalance: currentBalance, 
        error: 'Failed to add credits (unexpected error)' 
      };
    }
  }

  /**
   * Get comprehensive usage analytics for a user
   */
  static async getUsageAnalytics(userId: string): Promise<UsageAnalytics> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        credits: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        createdAt: true
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    const currentPlan = getCurrentPlan(user.subscriptionPlan)
    
    // Get current period start (subscription renewal or account creation)
    const currentPeriodStart = new Date()
    currentPeriodStart.setMonth(currentPeriodStart.getMonth() - 1)

    // Get all-time stats
    const [
      totalCreditsUsed,
      totalCreditsEarned,
      totalImagesGenerated,
      totalModelsCreated,
      currentPeriodCreditsUsed,
      currentPeriodImagesGenerated,
      currentPeriodModelsCreated,
      recentTransactions,
      usageTrends
    ] = await Promise.all([
      // Total credits used (all time)
      prisma.creditTransaction.aggregate({
        where: { 
          userId, 
          type: 'spent' 
        },
        _sum: { amount: true }
      }),
      
      // Total credits earned (all time)
      prisma.creditTransaction.aggregate({
        where: { 
          userId, 
          type: { in: ['earned', 'purchased', 'subscription_renewal'] }
        },
        _sum: { amount: true }
      }),
      
      // Total images generated
      prisma.generatedImage.count({
        where: { userId }
      }),
      
      // Total models created
      prisma.userModel.count({
        where: { userId }
      }),
      
      // Current period credits used
      prisma.creditTransaction.aggregate({
        where: {
          userId,
          type: 'spent',
          createdAt: { gte: currentPeriodStart }
        },
        _sum: { amount: true }
      }),
      
      // Current period images generated
      prisma.generatedImage.count({
        where: {
          userId,
          createdAt: { gte: currentPeriodStart }
        }
      }),
      
      // Current period models created
      prisma.userModel.count({
        where: {
          userId,
          createdAt: { gte: currentPeriodStart }
        }
      }),
      
      // Recent transactions
      prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          amount: true,
          type: true,
          description: true,
          createdAt: true,
          balanceAfter: true
        }
      }),
      
      // Usage trends (last 30 days)
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          SUM(CASE WHEN type = 'spent' THEN ABS(amount) ELSE 0 END) as credits_used,
          COUNT(CASE WHEN related_entity_type = 'image_generation' THEN 1 END) as images_generated
        FROM credit_transactions 
        WHERE user_id = ${userId} 
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `
    ])

    const currentPeriodUsed = Math.abs(currentPeriodCreditsUsed._sum.amount || 0)
    const percentageUsed = currentPlan.credits > 0 ? (currentPeriodUsed / currentPlan.credits) * 100 : 0

    return {
      currentPeriod: {
        creditsUsed: currentPeriodUsed,
        creditsRemaining: user.credits,
        imagesGenerated: currentPeriodImagesGenerated,
        modelsCreated: currentPeriodModelsCreated,
        percentageUsed: Math.round(percentageUsed * 100) / 100
      },
      allTime: {
        totalCreditsUsed: Math.abs(totalCreditsUsed._sum.amount || 0),
        totalCreditsEarned: totalCreditsEarned._sum.amount || 0,
        totalImagesGenerated,
        totalModelsCreated,
        totalSpent: Math.abs(totalCreditsUsed._sum.amount || 0) * 0.01 // Assuming 1 credit = $0.01
      },
      recentTransactions: recentTransactions.map(t => ({
        ...t,
        type: t.type as CreditTransactionType
      })),
      usageTrends: (usageTrends as any[]).map(trend => ({
        date: trend.date.toISOString().split('T')[0],
        creditsUsed: Number(trend.credits_used) || 0,
        imagesGenerated: Number(trend.images_generated) || 0
      }))
    }
  }

  /**
   * Check usage limits and permissions for a user
   */
  static async checkUsageLimits(userId: string): Promise<UsageLimits> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        credits: true,
        subscriptionPlan: true,
        subscriptionStatus: true
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    const currentPlan = getCurrentPlan(user.subscriptionPlan)
    
    // Count current models
    const currentModels = await prisma.userModel.count({
      where: { userId }
    })

    const warningThreshold = Math.floor(currentPlan.credits * 0.1) // 10% of monthly credits
    const isNearLimit = user.credits <= warningThreshold

    return {
      maxCreditsPerMonth: currentPlan.credits,
      maxModels: currentPlan.maxModels,
      currentCredits: user.credits,
      currentModels,
      canCreateModel: currentModels < currentPlan.maxModels,
      canGenerateImage: user.credits > 0,
      warningThreshold,
      isNearLimit
    }
  }

  /**
   * Check if user can perform an action that costs credits
   */
  static async canAfford(userId: string, creditCost: number): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true }
    })

    return user ? user.credits >= creditCost : false
  }

  /**
   * Get low credit notification data
   */
  static async getLowCreditNotification(userId: string): Promise<{
    shouldNotify: boolean
    message: string
    severity: 'warning' | 'critical'
    creditsRemaining: number
    suggestedAction: string
  } | null> {
    const limits = await this.checkUsageLimits(userId)
    
    if (!limits.isNearLimit) {
      return null
    }

    const severity = limits.currentCredits <= 5 ? 'critical' : 'warning'
    const message = severity === 'critical' 
      ? `You have only ${limits.currentCredits} credits remaining!`
      : `You're running low on credits (${limits.currentCredits} remaining).`
    
    const suggestedAction = severity === 'critical'
      ? 'Purchase more credits or upgrade your plan to continue generating images.'
      : 'Consider upgrading your plan or purchasing additional credits.'

    return {
      shouldNotify: true,
      message,
      severity,
      creditsRemaining: limits.currentCredits,
      suggestedAction
    }
  }
} 