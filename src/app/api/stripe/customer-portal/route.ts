import { NextResponse } from 'next/server';
import { auth } from '@/lib/next-auth'; // Corrected: Use auth from next-auth setup
import { prisma } from '@/lib/db'; // Corrected: Use named import for prisma
import { stripe } from '@/lib/stripe'; // Assuming stripe client is configured here

// It's good practice to get this from environment variables
const DEFAULT_RETURN_URL = process.env.STRIPE_CUSTOMER_PORTAL_RETURN_URL || '/dashboard/settings/billing';

export async function POST(req: Request) {
  const session = await auth(); // Corrected: Use auth() to get session

  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    });

    if (!user) {
      // This case should ideally not happen if session.user.id is valid
      // and comes from a trusted source like NextAuth. 
      // However, it's good practice to handle it.
      console.error(`User not found in DB with id: ${session.user.id}`);
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json({ error: 'Stripe customer ID not found.' }, { status: 400 });
    }

    // Construct the absolute return URL
    // In a real app, ensure NEXT_PUBLIC_BASE_URL is set correctly in your environment.
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.headers.get('origin') || 'http://localhost:3000';
    const returnUrl = `${baseUrl}${DEFAULT_RETURN_URL.startsWith('/') ? DEFAULT_RETURN_URL : '/' + DEFAULT_RETURN_URL}`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portalSession.url });

  } catch (error) {
    console.error('[CUSTOMER_PORTAL_API] Stripe Error:', error);
    // Consider more specific error handling for Stripe errors if needed
    let errorMessage = 'Internal server error.';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 