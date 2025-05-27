import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe'; // Adjusted path
import { PrismaClient } from '@prisma/client'; // Added import
import Stripe from 'stripe'; // Added import for Stripe type

const prisma = new PrismaClient(); // Added prisma client instantiation

// This is a basic placeholder. In a real scenario, you would:
// 1. Verify the Stripe webhook signature using `stripe.webhooks.constructEvent`
// 2. Handle the specific event types (e.g., 'checkout.session.completed')
// 3. Return a 200 OK to Stripe quickly, and handle business logic asynchronously if needed.

export async function POST(req: NextRequest) {
  // For now, we are not parsing the body or verifying the signature.
  // We are just acknowledging the request.
  // In a real implementation, ALWAYS verify the signature first.

  // Check if the request method is POST
  if (req.method !== 'POST') {
    // NextResponse.next() can be used for middleware or if you want to pass through
    // For an API endpoint, explicitly returning a 405 is more appropriate.
    return new NextResponse(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Allow': 'POST' },
    });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('🔴 STRIPE_WEBHOOK_SECRET is not set. Webhook processing aborted.');
    // For security, do not provide too much detail to the client if the secret is missing on the server.
    return NextResponse.json({ error: 'Webhook configuration error on server.' }, { status: 500 });
  }

  let event;
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.warn('⚠️ Missing stripe-signature header. Webhook ignored.');
      // Stripe documentation suggests responding with 400 if signature is missing.
      return NextResponse.json({ error: 'Webhook signature verification failed: Missing stripe-signature header.' }, { status: 400 });
    }

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );

    // console.log(`✅ Stripe event: ${event.id}, type: ${event.type}`);

    // TODO: Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const stripeCustomerId = session.customer as string | null; // customer can be string or null

        if (!userId) {
          console.error('🔴 Error: userId not found in session metadata. Cannot process checkout.session.completed.', { sessionId: session.id });
          // Still return 200 to Stripe to acknowledge receipt of the event
          return NextResponse.json({ received: true, error: 'User ID missing in metadata' }, { status: 200 });
        }

        console.log(`🔔 Processing checkout.session.completed for user ${userId}, session ${session.id}`);

        try {
          if (session.mode === 'subscription' && stripeCustomerId) {
            await prisma.user.update({
              where: { id: userId },
              data: {
                stripeCustomerId: stripeCustomerId,
                subscriptionStatus: 'active', // Assuming 'active' status
                // You might want to store subscriptionId, currentPeriodEnd, etc.
                // stripeSubscriptionId: session.subscription as string, // session.subscription is ID of the subscription
              },
            });
            console.log(`✅ User ${userId} subscription activated. Stripe Customer ID: ${stripeCustomerId}`);
          } else if (session.mode === 'payment') {
            const creditsPurchasedString = session.metadata?.credits_purchased;
            if (creditsPurchasedString) {
              const creditsPurchased = parseInt(creditsPurchasedString, 10);
              if (isNaN(creditsPurchased)) {
                console.error('🔴 Error: Invalid credits_purchased value in session metadata.', { sessionId: session.id, metadataValue: creditsPurchasedString });
                return NextResponse.json({ received: true, error: 'Invalid credits_purchased in metadata' }, { status: 200 });
              }
              await prisma.user.update({
                where: { id: userId },
                data: {
                  credits: {
                    increment: creditsPurchased,
                  },
                  // Optionally update stripeCustomerId if it's their first payment and they don't have one
                  ...(stripeCustomerId && { stripeCustomerId: stripeCustomerId }),
                },
              });
              console.log(`✅ User ${userId} credited with ${creditsPurchased} credits.`);
            } else {
              console.warn(`⚠️ checkout.session.completed in payment mode for user ${userId} but no 'credits_purchased' in metadata. Session ID: ${session.id}`);
            }
          } else {
            console.warn(`⚠️ Unhandled session mode: ${session.mode} for checkout.session.completed. Session ID: ${session.id}`);
          }
        } catch (dbError: any) {
          console.error(`🔴 Database error processing checkout.session.completed for user ${userId}:`, dbError.message, { sessionId: session.id });
          // Still return 200 to Stripe. Log the error for internal review.
          return NextResponse.json({ received: true, error: 'Database update failed' }, { status: 200 });
        }
        break;
      case 'invoice.payment_succeeded':
        // const invoice = event.data.object;
        // Handle successful payment for a subscription renewal, etc.
        // console.log('Invoice payment succeeded:', invoice);
        break;
      // ... handle other event types
      default:
        // console.warn(`🤷‍♀️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true, eventId: event.id }, { status: 200 });

  } catch (err: any) {
    console.error('🔴 Error processing Stripe webhook:', err.message);

    // Check for Stripe signature verification error more safely
    let isSignatureError = false;
    if (err.type === 'StripeSignatureVerificationError') {
      isSignatureError = true;
    } else if (stripe && stripe.errors && err instanceof stripe.errors.StripeSignatureVerificationError) {
      // This check is more robust if stripe and stripe.errors are defined
      isSignatureError = true;
    }

    if (isSignatureError) {
      return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
    }
    
    // For other errors during event construction or processing
    return NextResponse.json({ error: 'Webhook handler failed. View logs.' }, { status: 500 });
  }
}

// By not exporting GET, PUT, DELETE, etc., Next.js will automatically return 405 for those methods. 