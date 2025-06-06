import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/next-auth';
// import { stripe } from '@/lib/stripe'; // Using alias
import { stripe } from '@/lib/stripe'; // Reverted to alias for now, as relative didn't solve
import Stripe from 'stripe';
import { z } from 'zod';
import { getPlanById } from '@/lib/stripe/pricing';

// Define a schema for input validation
const createCheckoutSessionSchema = z.object({
  priceId: z.string().min(1, { message: 'Price ID or Plan ID is required' }),
  mode: z.enum(['payment', 'subscription', 'setup'], { message: 'Mode is required (e.g., subscription, payment)' }),
  quantity: z.number().int().min(1).optional().default(1),
  // You might add other parameters like metadata, customerId, etc.
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = session.user.id;
    const userEmail = session.user.email;

    let reqBody;
    try {
      reqBody = await req.json();
    } catch (parseError: any) {
      console.error('🔴 Error parsing request body:', parseError);
      return NextResponse.json({ error: 'Invalid request body: Could not parse JSON.' }, { status: 400 });
    }

    const validation = createCheckoutSessionSchema.safeParse(reqBody);
    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    
    let { priceId, mode, quantity } = validation.data;

    // Check if priceId is actually a plan ID and resolve it to a price ID
    const plan = getPlanById(priceId);
    if (plan) {
      if (!plan.priceId) {
        return NextResponse.json({ error: `No price ID available for plan: ${priceId}` }, { status: 400 });
      }
      priceId = plan.priceId;
    }

    // Safety check - make sure we have a non-empty price ID
    if (!priceId || priceId.trim() === '') {
      return NextResponse.json({ error: 'Invalid or missing price ID' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/dashboard/billing`;

    // TODO: Implement logic to get or create a Stripe Customer ID for the user
    // let stripeCustomerId = session.user.stripeCustomerId; // Assuming this field exists on your session.user
    // if (mode === 'subscription' && !stripeCustomerId) { /* create customer, save ID */ }

    const checkoutSessionCreateParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [
        {
          price: priceId,
          quantity: quantity,
        },
      ],
      mode: mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      // customer: stripeCustomerId, // Use if you have a Stripe customer ID
      customer_email: userEmail, // Fallback if no customer ID, good for one-time payments
      metadata: {
        userId: userId,
      },
    };

    if (mode === 'subscription') {
      checkoutSessionCreateParams.subscription_data = {
        metadata: {
          userId: userId,
        },
      };
    }

    const stripeSession = await stripe.checkout.sessions.create(checkoutSessionCreateParams);

    if (!stripeSession.url) {
        console.error('🔴 Stripe session was created but missing URL', stripeSession);
        return NextResponse.json({ error: 'Failed to create Stripe Checkout session: No URL returned' }, { status: 500 });
    }

    return NextResponse.json({ sessionId: stripeSession.id, url: stripeSession.url }, { status: 200 });

  } catch (error: any) {
    console.error('🔴 Error creating Stripe Checkout session:', error);
    if (error && typeof error.type === 'string' && typeof error.message === 'string') {
        if (error.type.startsWith('Stripe') || error.type.startsWith('invalid_request_error')) {
          return NextResponse.json({ error: `Stripe error: ${error.message}` }, { status: error.statusCode || 400 });
        }
      }
      return NextResponse.json({ error: 'Failed to create Stripe Checkout session. An unexpected error occurred.' }, { status: 500 });
  }
} 