import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const hours = parseInt(searchParams.get('hours') || '24')

    const since = new Date(Date.now() - hours * 60 * 60 * 1000)

    // Get webhook processing stats
    const [
      recentEvents,
      creditTransactions,
      subscriptionUpdates,
      duplicateCheck
    ] = await Promise.all([
      // Recent processed events
      prisma.processedStripeEvent.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),

      // Recent credit transactions  
      prisma.creditTransaction.findMany({
        where: { 
          createdAt: { gte: since },
          type: { in: ['subscription_initial', 'subscription_renewal'] }
        },
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),

      // Recent subscription status changes
      prisma.subscription.findMany({
        where: { createdAt: { gte: since } },
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),

      // Check for potential duplicates
      prisma.$queryRaw`
        SELECT 
          user_id,
          related_entity_id,
          type,
          COUNT(*) as count,
          SUM(amount) as total_credits
        FROM credit_transactions 
        WHERE created_at >= ${since}
          AND type IN ('subscription_initial', 'subscription_renewal')
        GROUP BY user_id, related_entity_id, type
        HAVING COUNT(*) > 1
      `
    ])

    // Calculate stats
    const stats = {
      totalEventsProcessed: recentEvents.length,
      creditTransactionsCount: creditTransactions.length,
      subscriptionUpdatesCount: subscriptionUpdates.length,
      potentialDuplicates: (duplicateCheck as any[]).length,
      
      // Event type breakdown
      eventTypes: recentEvents.reduce((acc: any, event) => {
        // Extract event type from eventId pattern (evt_xxx type is not stored)
        const type = 'processed_event' // We only store that it was processed
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {}),

      // Credit allocation breakdown
      creditsByType: creditTransactions.reduce((acc: any, tx) => {
        acc[tx.type] = (acc[tx.type] || { count: 0, total: 0 })
        acc[tx.type].count++
        acc[tx.type].total += tx.amount
        return acc
      }, {}),

      // User activity
      activeUsers: [...new Set(creditTransactions.map(tx => tx.userId))].length
    }

    return NextResponse.json({
      success: true,
      timeRange: `${hours} hours`,
      since: since.toISOString(),
      stats,
      recentEvents: recentEvents.slice(0, 10),
      recentCreditTransactions: creditTransactions.slice(0, 10),
      recentSubscriptions: subscriptionUpdates.slice(0, 10),
      potentialDuplicates: duplicateCheck,
      alerts: {
        duplicateCredits: (duplicateCheck as any[]).length > 0,
        highVolume: recentEvents.length > 100,
        lowActivity: recentEvents.length === 0 && hours > 1
      }
    })

  } catch (error: any) {
    console.error('Webhook monitor error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
} 