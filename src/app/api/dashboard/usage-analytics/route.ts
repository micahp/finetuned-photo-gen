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

    // Get comprehensive usage analytics
    const analytics = await CreditService.getUsageAnalytics(userId)

    return NextResponse.json({
      success: true,
      data: analytics
    })

  } catch (error) {
    console.error('Usage analytics API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 