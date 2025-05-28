import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/next-auth';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { z } from 'zod';

const createSubscriptionCheckoutSchema = z.object({
  priceId: z.string().min(1, { message: 'Price ID is required' }),
  returnUrl: z.string().url({ message: 'Valid Return URL is required' }),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const userEmail = session.user.email;

    const body = await req.json();
    const validation = createSubscriptionCheckoutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Price ID and Return URL are required.', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { priceId, returnUrl } = validation.data;

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!dbUser) {
      console.error(`User not found in database: ${userId}`);
      return NextResponse.json({ error: 'Could not find user.' }, { status: 500 });
    }

    const stripeCustomerId = dbUser.stripeCustomerId;
    let stripeSession;

    const success_url = `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${returnUrl}?canceled=true`;

    const checkoutSessionParams: any = {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url,
        cancel_url,
        metadata: { userId },
    };

    if (stripeCustomerId) {
        checkoutSessionParams.customer = stripeCustomerId;
    } else {
        checkoutSessionParams.customer_email = userEmail;
    }

    try {
      stripeSession = await stripe.checkout.sessions.create(checkoutSessionParams);
    } catch (error: any) {
      console.error('Stripe Checkout session creation failed:', error);
      return NextResponse.json(
        { error: 'Failed to create Stripe Checkout session.', details: error.message },
        { status: 500 }
      );
    }

    if (!stripeSession.url) {
        console.error('Stripe Checkout session URL is missing');
        return NextResponse.json({ error: 'Failed to create Stripe Checkout session. URL missing.' }, { status: 500 });
    }

    return NextResponse.json({ url: stripeSession.url }, { status: 200 });

  } catch (error: any) {
    console.error('POST /api/stripe/create-subscription-checkout error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
} 