import { NextResponse } from 'next/server';
import { auth } from '@/lib/next-auth';
import { prisma } from '@/lib/db';
import { CreditService } from '@/lib/credit-service';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        subscriptions: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.subscriptionStatus !== 'active') {
      return NextResponse.json({ 
        error: 'No active subscription found on your account' 
      }, { status: 400 });
    }

    const subscription = user.subscriptions[0];
    
    if (!subscription) {
      return NextResponse.json({ 
        error: 'No active subscription record found in the database' 
      }, { status: 400 });
    }

    const creditsToAdd = subscription.monthlyCredits || 0;
    
    if (creditsToAdd <= 0) {
      return NextResponse.json({ 
        error: 'Your subscription does not include monthly credits' 
      }, { status: 400 });
    }

    if (user.credits >= creditsToAdd) {
      return NextResponse.json({ 
        success: false, 
        message: `You already have ${user.credits} credits, which meets or exceeds your subscription allocation of ${creditsToAdd} credits.` 
      });
    }

    const result = await CreditService.addCredits(
      userId,
      creditsToAdd,
      'admin_adjustment',
      `Credit adjustment for ${subscription.planName} subscription`,
      'subscription',
      subscription.stripeSubscriptionId || undefined,
      { 
        planName: subscription.planName,
        selfService: true,
        reason: 'Self-service fix for missing initial subscription credits'
      }
    );

    if (!result.success) {
      return NextResponse.json({ 
        error: `Failed to add credits: ${result.error}` 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: `Added ${creditsToAdd} credits to your account`,
      newBalance: result.newBalance
    });
  } catch (error) {
    console.error('Error fixing credits:', error);
    return NextResponse.json({ 
      error: 'An unexpected error occurred' 
    }, { status: 500 });
  }
} 