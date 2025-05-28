import { NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { CreditService } from '@/lib/credit-service'

export async function GET() {
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

    // Get usage limits and permissions
    const limits = await CreditService.checkUsageLimits(userId)

    // Get low credit notification if applicable
    const notification = await CreditService.getLowCreditNotification(userId)

    return NextResponse.json({
      success: true,
      data: {
        limits,
        notification
      }
    })

  } catch (error) {
    console.error('Usage limits API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 