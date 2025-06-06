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
        
        // Idempotency check
        try {
          const existingEvent = await prisma.processedStripeEvent.findUnique({ where: { eventId: event.id } });
          if (existingEvent) {
            console.log(`ℹ️ Skipping already processed event: ${event.id}`);
            return NextResponse.json({ received: true, message: 'Event already processed' });
          }
        } catch (checkError) {
          console.warn(`⚠️ Error checking for processed event, continuing...: ${event.id}`, checkError);
        }

        console.log(`🔔 Processing checkout.session.completed for user ${userId}, session ${session.id}`);

        try {
          if (session.mode === 'subscription' && session.subscription && stripeCustomerId) {
            const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
            
            const stripeSubscription = await stripe.subscriptions.retrieve(
              subscriptionId,
              { expand: ['items.data.price.product'] }
            );

            if (!stripeSubscription || !stripeSubscription.items?.data.length) {
              console.error(`🔴 Error: Stripe subscription ${subscriptionId} not found or has no items data.`);
              return NextResponse.json({ received: true, error: 'Subscription details not found or items missing' }, { status: 200 });
            }

            const planItem = stripeSubscription.items.data[0];
            const product = planItem.price.product as Stripe.Product;
            const planName = product.name;
            const creditsFromPlanString = product.metadata?.credits || '0';
            const creditsToAllocate = parseInt(creditsFromPlanString, 10);

            if (isNaN(creditsToAllocate)) {
              console.error('🔴 Error: Invalid credits value in product metadata.', { productId: product.id, metadataValue: creditsFromPlanString });
              return NextResponse.json({ received: true, error: 'Invalid credits in product metadata' }, { status: 200 });
            }

            await prisma.$transaction(async (tx) => {
              await tx.user.update({
                where: { id: userId },
                data: {
                  stripeCustomerId: stripeCustomerId,
                  subscriptionStatus: stripeSubscription.status,
                  subscriptionPlan: planName,
                },
              });

              const subId = stripeSubscription.id;
              const subStatus = stripeSubscription.status;
              const subPeriodStart = (stripeSubscription as any).current_period_start;
              const subPeriodEnd = (stripeSubscription as any).current_period_end;
              
              const currentPeriodStart = new Date(subPeriodStart * 1000);
              const currentPeriodEnd = new Date(subPeriodEnd * 1000);

              await tx.subscription.upsert({
                where: { stripeSubscriptionId: subId },
                create: {
                  userId: userId,
                  stripeSubscriptionId: subId,
                  planName: planName,
                  status: subStatus,
                  currentPeriodStart: currentPeriodStart,
                  currentPeriodEnd: currentPeriodEnd,
                  monthlyCredits: creditsToAllocate,
                },
                update: {
                  status: subStatus,
                  planName: planName,
                  currentPeriodStart: currentPeriodStart,
                  currentPeriodEnd: currentPeriodEnd,
                  monthlyCredits: creditsToAllocate,
                },
              });

              await tx.processedStripeEvent.create({
                data: { eventId: event.id }
              });
            });

            console.log(`✅ User ${userId} subscription checkout for ${planName} processed. Credit allocation will be handled by invoice payment.`);

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
                },
                event.id // Pass Stripe event ID for idempotency
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
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        const subStripeCustomerId = subscription.customer as string;
        const subId = subscription.id;

        // Idempotency check
        try {
          const existingEvent = await prisma.processedStripeEvent.findUnique({
            where: { eventId: event.id }
          });
          
          if (existingEvent) {
            console.log(`ℹ️ Skipping already processed subscription event: ${event.id}`);
            return NextResponse.json({ received: true, message: 'Event already processed' });
          }
        } catch (checkError) {
          console.warn(`⚠️ Error checking for processed subscription event: ${event.id}`, checkError);
        }

        if (!subStripeCustomerId) {
          console.error(`🔴 Error: Missing Stripe customer ID in ${event.type} event.`, { subscriptionId: subId });
          return NextResponse.json({ received: true, warning: 'Missing customer ID in subscription event.' }, { status: 200 });
        }

        try {
          const user = await prisma.user.findFirst({
            where: { stripeCustomerId: subStripeCustomerId },
          });

          if (!user) {
            console.warn(`⚠️ User not found for stripeCustomerId ${subStripeCustomerId} in ${event.type}. Subscription will be processed if user is created later.`);
            return NextResponse.json({ received: true, warning: `User not found for customer ${subStripeCustomerId}.` }, { status: 200 });
          }
          const userId = user.id;

          if (!subscription.items?.data.length) {
            console.error(`🔴 Error: Subscription ${subId} has no items. Cannot determine plan/credits.`, { userId });
            return NextResponse.json({ received: true, warning: 'Subscription items missing.'}, { status: 200 });
          }

          const priceItem = subscription.items.data[0].price;
          if (typeof priceItem.product !== 'string') {
            console.error(`🔴 Error: Product ID missing or not a string in subscription item for ${subId}.`, { userId, priceId: priceItem?.id });
            return NextResponse.json({ received: true, warning: 'Product ID missing in subscription item.'}, { status: 200 });
          }
          const productId = priceItem.product;
          const stripeProduct = await stripe.products.retrieve(productId);

          const planName = stripeProduct.name;
          const creditsFromPlanString = stripeProduct.metadata?.credits || '0';
          const creditsToAllocate = parseInt(creditsFromPlanString, 10);

          if (isNaN(creditsToAllocate)) {
            console.error(`🔴 Error: Invalid credits value in product metadata for ${productId}.`, { userId, metadataValue: creditsFromPlanString });
            return NextResponse.json({ received: true, error: 'Invalid credits in product metadata' }, { status: 200 });
          }

          await prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: userId },
              data: {
                stripeCustomerId: subStripeCustomerId,
                subscriptionStatus: subscription.status,
                subscriptionPlan: planName,
              },
            });

            const periodStart = new Date((subscription as any).current_period_start * 1000);
            const periodEnd = new Date((subscription as any).current_period_end * 1000);

            await tx.subscription.upsert({
              where: { stripeSubscriptionId: subId },
              create: {
                userId: userId,
                stripeSubscriptionId: subId,
                planName: planName,
                status: subscription.status,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                monthlyCredits: creditsToAllocate, 
              },
              update: {
                planName: planName,
                status: subscription.status,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                monthlyCredits: creditsToAllocate,
              },
            });

            // Mark event as processed to prevent duplicate processing
            await tx.processedStripeEvent.create({
              data: { eventId: event.id }
            });
          });

          console.log(`✅ ${event.type} for ${subId} processed for user ${userId}. Subscription status synchronized.`);

        } catch (err: any) {
          console.error(`🔴 Error processing ${event.type} for subscription ${subId}:`, err.message, err.stack);
          return NextResponse.json({ received: true, error: `Failed to process ${event.type}. View logs.` , details: err.message }, { status: 200 });
        }
        break;
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;
        const deletedSubStripeCustomerId = deletedSubscription.customer as string;
        const deletedSubId = deletedSubscription.id;
        // console.log(`[DEBUG] Processing customer.subscription.deleted for ${deletedSubId}`);
        if (!deletedSubStripeCustomerId) {
            console.error('🔴 Error: Missing customer ID in customer.subscription.deleted', { subscriptionId: deletedSubId });
            return NextResponse.json({ received: true, eventId: event.id, warning: 'Missing customer ID.' }, { status: 200 });
        }
        try {
            const user = await prisma.user.findFirst({ where: { stripeCustomerId: deletedSubStripeCustomerId } });
            if (!user) {
                console.error('🔴 Error: User not found for customer.subscription.deleted', { stripeCustomerId: deletedSubStripeCustomerId });
                return NextResponse.json({ received: true, eventId: event.id, warning: 'User not found.' }, { status: 200 });
            }
            // Update the user and subscription records in a transaction
            await prisma.$transaction(async (tx) => {
                await tx.user.update({
                    where: { id: user.id },
                    data: { 
                        subscriptionStatus: deletedSubscription.status, // e.g., 'canceled'
                        // Mark the session as invalidated so the client knows to refresh
                        sessionInvalidatedAt: new Date()
                    },
                });
                await tx.subscription.updateMany({
                    where: { stripeSubscriptionId: deletedSubId, userId: user.id },
                    data: { status: deletedSubscription.status }, // e.g., 'canceled'
                });
            });
            
            console.log(`✅ Subscription ${deletedSubId} status updated to ${deletedSubscription.status} for user ${user.id}.`);
            
            // Also notify our session invalidation API to ensure immediate effect
            try {
                // Call our internal API to trigger additional session invalidation mechanisms
                const response = await fetch(new URL('/api/auth/invalidate-session', process.env.NEXTAUTH_URL).toString(), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': process.env.INTERNAL_API_KEY || '',
                    },
                    body: JSON.stringify({ userId: user.id }),
                });
                
                if (!response.ok) {
                    console.warn(`⚠️ Failed to invalidate session for user ${user.id} after subscription cancellation`);
                } else {
                    console.log(`✅ Successfully triggered session invalidation for user ${user.id}`);
                }
            } catch (invalidateError) {
                console.error(`🔴 Error calling session invalidation API:`, invalidateError);
                // Continue with webhook processing even if this fails
            }
        } catch (err: any) {
            console.error(`🔴 Error processing customer.subscription.deleted for ${deletedSubId}:`, err.message);
            return NextResponse.json({ received: true, eventId: event.id, error: 'Failed to process subscription deletion.', details: err.message }, { status: 200 });
        }
        break;
      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice;
        const invStripeCustomerId = invoice.customer as string;

        // Idempotency check
        try {
          const existingEvent = await prisma.processedStripeEvent.findUnique({ where: { eventId: event.id } });
          if (existingEvent) {
            console.log(`ℹ️ Skipping already processed event: ${event.id}`);
            return NextResponse.json({ received: true, message: 'Event already processed' });
          }
        } catch (checkError) {
          console.warn(`⚠️ Error checking for processed event, continuing...: ${event.id}`, checkError);
        }

        if (!invStripeCustomerId) {
          console.error('🔴 Error: Missing or invalid customer ID in invoice.payment_succeeded event.', { invoiceId: invoice.id });
          return NextResponse.json({ received: true, warning: 'Missing customer ID in invoice.' }, { status: 200 });
        }

        // For subscription payments, amount_paid > 0. For trials, it's 0.
        // We only allocate credits for paid invoices.
        if (invoice.amount_paid <= 0) {
          console.log(`ℹ️ Invoice ${invoice.id} for $0, no credits to process. Billing reason: ${invoice.billing_reason}`);
          // We still mark as processed to avoid re-checking.
          await prisma.processedStripeEvent.create({ data: { eventId: event.id } });
          return NextResponse.json({ received: true, message: '$0 invoice, no credits processed.' });
        }

        const invSubscriptionId = (invoice as any).subscription as string;
        if (!invSubscriptionId) {
          console.warn(`⚠️ Invoice ${invoice.id} paid, but no subscription ID found. Not a subscription renewal.`);
          return NextResponse.json({ received: true, warning: 'No subscription ID on invoice, not a renewal.' }, { status: 200 });
        }

        try {
          const user = await prisma.user.findFirst({
            where: { stripeCustomerId: invStripeCustomerId }
          });

          if (!user) {
            console.error(`🔴 Error: User not found for stripeCustomerId ${invStripeCustomerId} from invoice ${invoice.id}.`);
            return NextResponse.json({ received: true, warning: `User not found for customer ${invStripeCustomerId}.` }, { status: 200 });
          }
          const userId = user.id;

          const stripeSubscription = await stripe.subscriptions.retrieve(invSubscriptionId, {
            expand: ['items.data.price.product'],
          });

          if (!stripeSubscription?.items?.data.length) {
            console.error(`🔴 Error: Subscription ${invSubscriptionId} from invoice ${invoice.id} not found or has no items.`);
            return NextResponse.json({ received: true, warning: 'Subscription details not found for invoice.' }, { status: 200 });
          }

          const product = stripeSubscription.items.data[0].price.product as Stripe.Product;
          const planName = product.name;
          const creditsToAllocate = parseInt(product.metadata?.credits || '0', 10);

          if (isNaN(creditsToAllocate) || creditsToAllocate <= 0) {
            console.error(`🔴 Error: Invalid or zero credits in product metadata for ${product.id}. No credits added.`);
          } else {
            await CreditService.addCredits(
                userId,
                creditsToAllocate,
                'subscription_renewal',
                `Credits for ${planName} renewal`,
                'subscription',
                invSubscriptionId,
                { planName, stripeSubscriptionId: invSubscriptionId, invoiceId: invoice.id },
                event.id
            );
            console.log(`✅ ${creditsToAllocate} credits added for user ${userId} from invoice ${invoice.id}. Plan: ${planName}.`);
          }

          const invoiceLineItem = invoice.lines.data[0];
          const invoicePeriodStart = new Date(invoiceLineItem.period.start * 1000);
          const invoicePeriodEnd = new Date(invoiceLineItem.period.end * 1000);

          await prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: userId },
              data: {
                subscriptionStatus: stripeSubscription.status,
                subscriptionPlan: planName,
              },
            });

            await tx.subscription.update({
              where: { stripeSubscriptionId: invSubscriptionId },
              data: {
                status: stripeSubscription.status,
                currentPeriodStart: invoicePeriodStart,
                currentPeriodEnd: invoicePeriodEnd,
                monthlyCredits: creditsToAllocate,
              },
            });

            await tx.processedStripeEvent.create({
              data: { eventId: event.id }
            });
          });

          console.log(`✅ Invoice ${invoice.id} processed for user ${userId}. Subscription ${invSubscriptionId} updated.`);

        } catch (err: any) {
          console.error(`🔴 Error processing invoice.payment_succeeded for invoice ${invoice.id}:`, err.message, err.stack);
          return NextResponse.json({ received: true, error: 'Failed to process invoice. View logs.', details: err.message }, { status: 200 });
        }
        break;
      default:
        console.log(`🔔 Received unhandled event type: ${event.type}`, { eventId: event.id });
        // Optional: Store unhandled events in DB for review if they become frequent
        // await prisma.unhandledStripeEvent.create({ data: { eventId: event.id, eventType: event.type, rawPayload: event }});
    }

    // Return a 200 response to acknowledge receipt of the event
    // console.log(`[TEST_DEBUG] Event ${event.id} processed. Sending 200 OK.`);
    return NextResponse.json({ received: true, eventId: event.id });

  } catch (err: any) {
    // console.error('[TEST_DEBUG] Error in webhook handler:', err.message);
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