import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { CreditService } from '@/lib/credit-service'

export interface UsageLimitOptions {
  requireCredits?: number
  requireModelSlots?: boolean
  operation: 'image_generation' | 'model_training' | 'model_creation'
}

/**
 * Middleware to check usage limits before allowing operations
 */
export async function checkUsageLimits(
  request: NextRequest,
  options: UsageLimitOptions
): Promise<NextResponse | null> {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Get usage limits
    const limits = await CreditService.checkUsageLimits(userId)

    // Check credit requirements
    if (options.requireCredits && options.requireCredits > 0) {
      if (!limits.canGenerateImage || limits.currentCredits < options.requireCredits) {
        return NextResponse.json(
          { 
            error: 'Insufficient credits',
            details: {
              required: options.requireCredits,
              available: limits.currentCredits,
              operation: options.operation
            }
          },
          { status: 400 }
        )
      }
    }

    // Check model slot requirements
    if (options.requireModelSlots) {
      if (!limits.canCreateModel) {
        return NextResponse.json(
          { 
            error: 'Model limit reached',
            details: {
              currentModels: limits.currentModels,
              maxModels: limits.maxModels,
              operation: options.operation,
              suggestion: limits.maxModels === 0 
                ? 'Upgrade your plan to create custom models'
                : `You can have up to ${limits.maxModels} models. Delete existing models or upgrade your plan.`
            }
          },
          { status: 400 }
        )
      }
    }

    // Check for low credit warnings
    const notification = await CreditService.getLowCreditNotification(userId)
    if (notification && notification.severity === 'critical' && options.operation === 'image_generation') {
      // For critical low credits, we might want to warn but still allow the operation
      // since we already checked they have enough credits above
      console.warn(`User ${userId} has critically low credits (${notification.creditsRemaining}) but proceeding with ${options.operation}`)
    }

    // All checks passed, return null to continue
    return null

  } catch (error) {
    console.error('Usage limits check error:', error)
    return NextResponse.json(
      { error: 'Failed to check usage limits' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to get usage limits for a user (for frontend display)
 */
export async function getUserUsageLimits(userId: string) {
  try {
    const limits = await CreditService.checkUsageLimits(userId)
    const notification = await CreditService.getLowCreditNotification(userId)
    
    return {
      success: true,
      data: {
        limits,
        notification,
        warnings: {
          lowCredits: notification?.severity === 'warning',
          criticalCredits: notification?.severity === 'critical',
          modelLimitReached: !limits.canCreateModel,
          nearModelLimit: limits.currentModels >= limits.maxModels * 0.8
        }
      }
    }
  } catch (error) {
    console.error('Get usage limits error:', error)
    return {
      success: false,
      error: 'Failed to get usage limits'
    }
  }
} 