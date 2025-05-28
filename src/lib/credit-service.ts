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
  }> {
    try {
      let finalBalance = 0;
      let transactionResult: { id: string; balanceAfter: number } | null = null;

      await prisma.$transaction(async (tx) => {
        // Update user credits
        const updatedUser = await tx.user.update({
          where: { id: data.userId },
          data: { credits: { increment: data.amount } },
          select: { credits: true }
        });

        finalBalance = updatedUser.credits;

        // Create transaction record
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
          },
          select: { id: true }
        });

        transactionResult = { id: createdTx.id, balanceAfter: finalBalance }; 
      });

      if (transactionResult) {
        return {
          success: true,
          newBalance: (transactionResult as { id: string; balanceAfter: number }).balanceAfter,
          transactionId: (transactionResult as { id: string; balanceAfter: number }).id,
        };
      } else {
        // This case should ideally not be reached if $transaction throws on failure
        return { success: false, error: 'Transaction did not complete as expected.', newBalance: finalBalance };
      }
    } catch (error: any) {
      console.error('Error in recordTransaction:', error);
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
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; newBalance: number; error?: string }> {
    try {
      const transactionResult = await this.recordTransaction({
        userId,
        amount,
        type,
        description,
        relatedEntityType,
        relatedEntityId,
        metadata
      });

      if (!transactionResult.success) {
        // If recordTransaction handled an error and returned success: false
        // We don't have the pre-transaction balance readily available here without an extra DB call.
        // recordTransaction itself doesn't return old balance on failure.
        // Returning 0 for newBalance or fetching it again are options.
        // For now, let's be consistent with the generic catch block if recordTransaction fails this way.
        return {
          success: false,
          // newBalance: 0, // Or fetch current balance if absolutely needed.
          // Let's try to return the balance that recordTransaction *would* have resulted in if it didn't complete, which is effectively undefined or requires another fetch.
          // The most straightforward is to mirror the main catch block or provide a specific error.
          newBalance: (await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } }))?.credits || 0,
          error: transactionResult.error || 'Failed to add credits (recordTransaction failed)',
        };
      }

      // If recordTransaction was successful, its newBalance is the most accurate.
      // The subsequent findUnique is to confirm, but recordTransaction.newBalance should be trusted.
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true }
      });

      // It's possible recordTransaction succeeded but the user fetch here fails or user deleted.
      // The newBalance from recordTransaction is the state after the transaction.
      return { success: true, newBalance: transactionResult.newBalance! }; // Trust newBalance from successful recordTransaction

    } catch (error) {
      console.error('Error adding credits:', error);
      // Attempt to get current balance even in case of an unexpected error, if user exists
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