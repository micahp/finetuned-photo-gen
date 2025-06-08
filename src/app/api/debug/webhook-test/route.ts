import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { CreditService } from '@/lib/credit-service'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 })
    }

    // Check Stripe products and their metadata
    const products = await stripe.products.list({ limit: 10 })
    
    const productInfo = await Promise.all(
      products.data.map(async (product) => {
        const prices = await stripe.prices.list({ product: product.id })
        return {
          id: product.id,
          name: product.name,
          metadata: product.metadata,
          credits: product.metadata?.credits ? parseInt(product.metadata.credits, 10) : 0,
          prices: prices.data.map(price => ({
            id: price.id,
            amount: price.unit_amount,
            currency: price.currency
          }))
        }
      })
    )

    // Check recent credit transactions
    const recentTransactions = await prisma.creditTransaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { email: true, credits: true }
        }
      }
    })

    // Check recent processed Stripe events
    const recentEvents = await prisma.processedStripeEvent.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      products: productInfo,
      recentTransactions,
      recentEvents,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 })
    }

    const { userId, credits, testType } = await req.json()

    if (testType === 'test_credit_allocation') {
      if (!userId || !credits) {
        return NextResponse.json({ error: 'userId and credits required' }, { status: 400 })
      }

      const result = await CreditService.addCredits(
        userId,
        credits,
        'admin_adjustment',
        'Test credit allocation from debug endpoint',
        'admin_action',
        undefined,
        { testAllocation: true, adminUserId: session.user.id }
      )

      return NextResponse.json({
        success: result.success,
        newBalance: result.newBalance,
        error: result.error,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({ error: 'Invalid test type' }, { status: 400 })
  } catch (error) {
    console.error('Debug POST endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 