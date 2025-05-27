import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe'; // Adjusted path
import { prisma } from '@/lib/db'; // Use shared Prisma instance
import Stripe from 'stripe'; // Added import for Stripe type
import { CreditService } from '@/lib/credit-service'

// This is a basic placeholder. In a real scenario, you would:
// 1. Verify the Stripe webhook signature using `stripe.webhooks.constructEvent`
// 2. Handle the specific event types (e.g., 'checkout.session.completed')
// 3. Return a 200 OK to Stripe quickly, and handle business logic asynchronously if needed.

export async function POST(req: NextRequest) {
  // console.log('[TEST_DEBUG] POST HANDLER ENTERED'); 

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
    // console.log(`[TEST_DEBUG] Stripe event constructed: ${event.id}, type: ${event.type}`);

    // TODO: Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        let stripeCustomerId: string | null = null;
        if (typeof session.customer === 'string') {
          stripeCustomerId = session.customer;
        } else if (session.customer && typeof session.customer === 'object' && session.customer.id) {
          stripeCustomerId = session.customer.id;
        }
        
        if (!userId) {
          console.error('🔴 Error: userId not found in session metadata.', { sessionId: session.id });
          return NextResponse.json({ received: true, error: 'User ID missing in metadata' }, { status: 200 });
        }

        // console.log(`🔔 Processing checkout.session.completed for user ${userId}, session ${session.id}`); // Original log, can be restored if desired

        try {
          if (session.mode === 'subscription' && session.subscription && stripeCustomerId) {
            const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
            // console.log(`[TEST_DEBUG] About to retrieve Stripe subscription: ${subscriptionId}`);
            
            const stripeSubscription = await stripe.subscriptions.retrieve(
              subscriptionId,
              { expand: ['items.data.price.product'] }
            );
            // console.log('[TEST_DEBUG] stripeSubscription:', JSON.stringify(stripeSubscription, null, 2));

            if (!stripeSubscription || !stripeSubscription.items || !stripeSubscription.items.data || !stripeSubscription.items.data.length) {
              console.error(`🔴 Error: Stripe subscription ${subscriptionId} not found or has no items data.`);
              // console.log('[TEST_DEBUG] Condition !stripeSubscription || !stripeSubscription.items.data.length met');
              return NextResponse.json({ received: true, error: 'Subscription details not found or items missing' }, { status: 200 });
            }

            const planItem = stripeSubscription.items.data[0];
            const price = planItem.price;
            const product = price.product as Stripe.Product;
            // console.log('[TEST_DEBUG] product:', JSON.stringify(product, null, 2));

            const planName = product.name;
            const creditsFromPlanString = product.metadata?.credits || '0';
            const creditsToAllocate = parseInt(creditsFromPlanString, 10);
            // console.log('[TEST_DEBUG] planName:', planName, 'creditsFromPlanString:', creditsFromPlanString, 'creditsToAllocate:', creditsToAllocate);

            if (isNaN(creditsToAllocate)) {
              console.error('🔴 Error: Invalid credits value in product metadata.', { productId: product.id, metadataValue: creditsFromPlanString });
              // console.log('[TEST_DEBUG] Condition isNaN(creditsToAllocate) met');
              return NextResponse.json({ received: true, error: 'Invalid credits in product metadata' }, { status: 200 });
            }

            // console.log('[TEST_DEBUG] Reaching transaction block');
            await prisma.$transaction(async (tx) => {
              // Update user subscription details
              await tx.user.update({
                where: { id: userId },
                data: {
                  stripeCustomerId: stripeCustomerId,
                  subscriptionStatus: stripeSubscription.status, // Use status from retrieved subscription
                  subscriptionPlan: planName,
                },
              });

              // Assuming stripeSubscription is correctly typed as Stripe.Subscription by this point
              const subId = stripeSubscription.id;
              const subStatus = stripeSubscription.status;
              // Cast to any for problematic properties to bypass persistent linter issue
              const subPeriodStart = (stripeSubscription as any).current_period_start;
              const subPeriodEnd = (stripeSubscription as any).current_period_end;

              await tx.subscription.upsert({
                where: { stripeSubscriptionId: subId },
                create: {
                  userId: userId,
                  stripeSubscriptionId: subId,
                  planName: planName,
                  status: subStatus,
                  currentPeriodStart: new Date(subPeriodStart * 1000),
                  currentPeriodEnd: new Date(subPeriodEnd * 1000),
                  monthlyCredits: creditsToAllocate,
                },
                update: {
                  status: subStatus,
                  planName: planName,
                  currentPeriodStart: new Date(subPeriodStart * 1000),
                  currentPeriodEnd: new Date(subPeriodEnd * 1000),
                  monthlyCredits: creditsToAllocate,
                },
              });
            });

            // Add credits using CreditService for proper transaction logging
            await CreditService.addCredits(
              userId,
              creditsToAllocate,
              'subscription_renewal',
              `Subscription renewal: ${planName}`,
              'subscription',
              stripeSubscription.id,
              {
                planName,
                stripeSubscriptionId: stripeSubscription.id,
                periodStart: new Date((stripeSubscription as any).current_period_start * 1000),
                periodEnd: new Date((stripeSubscription as any).current_period_end * 1000)
              }
            );

            console.log(`✅ User ${userId} subscription ${stripeSubscription.id} processed. Plan: ${planName}, Credits: ${creditsToAllocate}.`);

          } else if (session.mode === 'payment') {
            const creditsPurchasedStr = session.metadata?.credits_purchased;
            let creditsPurchased: number | undefined;
            if (creditsPurchasedStr) {
                creditsPurchased = parseInt(creditsPurchasedStr, 10);
            }

            if (creditsPurchasedStr && creditsPurchased !== undefined && !isNaN(creditsPurchased) && creditsPurchased > 0) {
              // Update customer ID if provided
              if (stripeCustomerId) {
                await prisma.user.update({
                  where: { id: userId },
                  data: { stripeCustomerId },
                });
              }

              // Add credits using CreditService for proper transaction logging
              await CreditService.addCredits(
                userId,
                creditsPurchased,
                'purchased',
                `Credit purchase: ${creditsPurchased} credits`,
                'subscription',
                session.id,
                {
                  sessionId: session.id,
                  stripeCustomerId,
                  paymentMode: 'payment'
                }
              );
              
              console.log(`✅ User ${userId} credited with ${creditsPurchased} credits.`);
            } else if (!creditsPurchasedStr) { // If credits_purchased is missing entirely
              console.warn(`⚠️ checkout.session.completed in payment mode for user ${userId} but no 'credits_purchased' in metadata. Session ID: ${session.id}`);
            } else { // Invalid (e.g., NaN after parse) or non-positive credits_purchased
              console.error('🔴 Error: Invalid credits_purchased value.', { sessionId: session.id, val: creditsPurchasedStr });
              return NextResponse.json({ received: true, error: 'Invalid credits_purchased in metadata' }, { status: 200 });
            }
          } else {
            console.warn(`⚠️ Unhandled session mode: ${session.mode} or missing data. Session: ${session.id}`);
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