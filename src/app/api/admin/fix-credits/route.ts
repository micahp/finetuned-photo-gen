import { NextResponse } from 'next/server';
import { auth } from '@/lib/next-auth';
import { prisma } from '@/lib/db';
import { CreditService } from '@/lib/credit-service';

export async function POST(req: Request) {
  try {
    // Check if the user is authenticated and is an admin
    const session = await auth();
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get the user and their subscription
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

    const subscription = user.subscriptions[0];
    
    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    // Add credits based on the subscription plan
    const creditsToAdd = subscription.monthlyCredits || 0;
    
    if (creditsToAdd <= 0) {
      return NextResponse.json({ 
        error: 'No credits to add (subscription has 0 monthly credits)'
      }, { status: 400 });
    }

    // Add the credits
    const result = await CreditService.addCredits(
      userId,
      creditsToAdd,
      'admin_adjustment', // Using this transaction type
      `Manual credit adjustment for ${subscription.planName} subscription`,
      'subscription',
      subscription.stripeSubscriptionId || undefined,
      { 
        planName: subscription.planName,
        manuallyApplied: true,
        appliedBy: session.user.id,
        reason: 'Fix for missing initial subscription credits'
      }
    );

    if (!result.success) {
      return NextResponse.json({ 
        error: `Failed to add credits: ${result.error}` 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Added ${creditsToAdd} credits to user ${userId}`,
      newBalance: result.newBalance
    });
  } catch (error) {
    console.error('Error fixing credits:', error);
    return NextResponse.json({ 
      error: 'An unexpected error occurred'
    }, { status: 500 });
  }
} 