import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '../../../../lib/stripe'; // Adjusted path
import { prisma } from '@/lib/db'; // Use shared Prisma instance
import Stripe from 'stripe'; // Added import for Stripe type
import { CreditService } from '@/lib/credit-service'
import { PLANS } from '@/config/stripe';

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

  let event: any;
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
    console.log(`🔔 Webhook received: ${event.type} (${event.id})`);

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
          if (session.mode === 'subscription' && session.subscription) {
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

            // Find the plan in our configuration (case-insensitive)
            const appPlan = Object.values(PLANS).find(p => p.name.toLowerCase() === planName.toLowerCase());

            if (appPlan) {
              if (appPlan.credits !== creditsToAllocate) {
                console.warn(`⚠️ Stripe plan credit mismatch for "${planName}". App config: ${appPlan.credits}, Stripe: ${creditsToAllocate}. Using Stripe's value.`);
              }
            } else {
              console.warn(`⚠️ Plan "${planName}" from Stripe not found in app configuration. Cannot verify credit amount.`);
            }

            if (isNaN(creditsToAllocate)) {
              console.error('🔴 Error: Invalid credits value in product metadata.', { productId: product.id, metadataValue: creditsFromPlanString });
              return NextResponse.json({ received: true, error: 'Invalid credits in product metadata' }, { status: 200 });
            }

            await prisma.$transaction(async (tx) => {
              const userData: any = {
                subscriptionStatus: stripeSubscription.status,
                // Use the canonical plan name from our app's config to ensure consistency
                subscriptionPlan: appPlan ? appPlan.name : planName, 
              };
              
              // Only update stripeCustomerId if we have one
              if (stripeCustomerId) {
                userData.stripeCustomerId = stripeCustomerId;
              }
              
              console.log(`[DIAGNOSTIC] Updating user in checkout.session.completed`, { userId, data: userData });
              await tx.user.update({
                where: { id: userId },
                data: userData,
              });

              const subId = stripeSubscription.id;
              const subStatus = stripeSubscription.status;
              const subPeriodStart = (stripeSubscription as any).current_period_start;
              const subPeriodEnd = (stripeSubscription as any).current_period_end;
              
              const currentPeriodStart = new Date(subPeriodStart ? subPeriodStart * 1000 : Date.now());
              const currentPeriodEnd = new Date(subPeriodEnd ? subPeriodEnd * 1000 : Date.now());

              await tx.subscription.upsert({
                where: { stripeSubscriptionId: subId },
                create: {
                  userId: userId,
                  stripeSubscriptionId: subId,
                  // Use the canonical plan name from our app's config
                  planName: appPlan ? appPlan.name : planName,
                  status: subStatus,
                  currentPeriodStart: currentPeriodStart,
                  currentPeriodEnd: currentPeriodEnd,
                  monthlyCredits: creditsToAllocate,
                },
                update: {
                  status: subStatus,
                  // Use the canonical plan name from our app's config
                  planName: appPlan ? appPlan.name : planName,
                  currentPeriodStart: currentPeriodStart,
                  currentPeriodEnd: currentPeriodEnd,
                  monthlyCredits: creditsToAllocate,
                },
              });

              await tx.processedStripeEvent.create({
                data: { eventId: event.id }
              });
            });

            // Allocate initial credits for the new subscription
            if (creditsToAllocate > 0) {
              await CreditService.addCredits(
                userId,
                creditsToAllocate,
                'subscription_initial',
                `Initial credits for ${planName} plan`,
                'subscription',
                subscriptionId,
                { planName: planName, stripeSubscriptionId: subscriptionId },
                event.id // Use the checkout session event ID for idempotency
              );
              console.log(`✅ User ${userId} allocated ${creditsToAllocate} initial credits for ${planName}.`);
            } else {
              console.log(`ℹ️ Subscription for ${planName} started for user ${userId}, no initial credits to allocate.`);
            }

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
          const creditsFromPlan = parseInt(stripeProduct.metadata?.credits || '0', 10);

          await prisma.$transaction(async (tx) => {
            // Special handling for canceled subscriptions
            if (subscription.status === 'canceled') {
              const userData = {
                subscriptionPlan: null, // Revert to free plan
                subscriptionStatus: 'free', // Use a clear 'free' status
                stripeSubscriptionStatus: 'canceled', // Keep the Stripe status for reference
              };
              console.log(`[DIAGNOSTIC] Updating user in customer.subscription.updated (canceled)`, { userId, data: userData });
              await tx.user.update({
                where: { id: userId },
                data: userData,
              });
              console.log(`✅ User ${userId} subscription plan set to free due to cancellation.`);
            } else {
              // Standard update for other status changes (e.g., active, past_due)
              const userData = {
                subscriptionStatus: subscription.status,
                subscriptionPlan: planName,
                stripeSubscriptionStatus: subscription.status,
              };
              console.log(`[DIAGNOSTIC] Updating user in customer.subscription.updated (active)`, { userId, data: userData });
              await tx.user.update({
                where: { id: userId },
                data: userData,
              });
            }

            // Update local Subscription record
            await tx.subscription.updateMany({
              where: { stripeSubscriptionId: subId },
              data: {
                status: subscription.status,
                planName: planName,
                currentPeriodStart: new Date((subscription as any).current_period_start ? (subscription as any).current_period_start * 1000 : Date.now()),
                currentPeriodEnd: new Date((subscription as any).current_period_end ? (subscription as any).current_period_end * 1000 : Date.now()),
                monthlyCredits: creditsFromPlan,
              },
            });

            // Mark event as processed to prevent duplicate processing
            await tx.processedStripeEvent.create({
              data: { eventId: event.id }
            });
          });

          // Add credits for subscription creation or activation
          console.log(`🔍 Credit allocation check: creditsFromPlan=${creditsFromPlan}, subscription.status=${subscription.status}, event.type=${event.type}`);
          
          if (creditsFromPlan > 0) {
            try {
              const previousSubStatus = (event.data.object as any).previous_attributes?.status;
              
              // For subscription.created, always allocate initial credits regardless of status
              // For subscription.updated, only allocate if becoming active
              const shouldAllocateCredits = event.type === 'customer.subscription.created' || 
                                          (previousSubStatus && previousSubStatus !== 'active' && subscription.status === 'active');
              
              if (shouldAllocateCredits) {
                const creditEventType = event.type === 'customer.subscription.created' ? 'subscription_initial' :
                                      (previousSubStatus && previousSubStatus !== 'active' && subscription.status === 'active') ? 'subscription_renewal' :
                                      'subscription_renewal';
                
                const creditDescription = event.type === 'customer.subscription.created' ? 
                  `Initial credits for new ${planName} subscription` :
                  (previousSubStatus && previousSubStatus !== 'active' && subscription.status === 'active') ?
                  `Credits for activated ${planName} subscription` :
                  `Credits for updated ${planName} subscription`;

                console.log(`🔄 Allocating ${creditsFromPlan} credits for user ${userId}...`);
                
                await CreditService.addCredits(
                  userId,
                  creditsFromPlan,
                  creditEventType,
                  creditDescription,
                  'subscription',
                  subId,
                  {
                    planName,
                    stripeSubscriptionId: subId,
                    status: subscription.status,
                    eventType: event.type
                  },
                  event.id
                );
                
                console.log(`✅ ${creditsFromPlan} credits added for user ${userId} from ${event.type}. Plan: ${planName}.`);
              } else {
                console.log(`ℹ️ Skipping credit allocation for ${event.type}: subscription status is ${subscription.status}, previous status was ${previousSubStatus}`);
              }
            } catch (creditError: any) {
              console.error(`🔴 Failed to add credits for user ${userId} during ${event.type}:`, creditError);
              // Don't fail the webhook - credits can be allocated manually if needed
            }
          } else {
            console.log(`ℹ️ No credits to allocate: creditsFromPlan=${creditsFromPlan}`);
          }

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
                const userData = { 
                    subscriptionPlan: null, // Revert to free plan
                    subscriptionStatus: 'free', // Use a clear 'free' status
                    stripeSubscriptionStatus: deletedSubscription.status, // e.g., 'canceled'
                };
                console.log(`[DIAGNOSTIC] Updating user in customer.subscription.deleted`, { userId: user.id, data: userData });
                await tx.user.update({
                    where: { id: user.id },
                    data: userData,
                });
                await tx.subscription.updateMany({
                    where: { stripeSubscriptionId: deletedSubId, userId: user.id },
                    data: { status: deletedSubscription.status }, // e.g., 'canceled'
                });
            });
            
            console.log(`✅ Subscription ${deletedSubId} status updated to ${deletedSubscription.status} for user ${user.id}.`);
            
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
        // We only allocate credits for paid invoices that are for subscription renewals.
        if (invoice.amount_paid <= 0 || invoice.billing_reason === 'subscription_create') {
          if (invoice.billing_reason === 'subscription_create') {
            console.log(`ℹ️ Invoice ${invoice.id} is for a new subscription. Credits were already allocated at checkout. Skipping.`);
          } else {
            console.log(`ℹ️ Invoice ${invoice.id} for $0, no credits to process. Billing reason: ${invoice.billing_reason}`);
          }
          // We still mark as processed to avoid re-checking.
          await prisma.processedStripeEvent.create({ data: { eventId: event.id } });
          return NextResponse.json({ received: true, message: 'Invoice not for renewal or $0, no credits processed.' });
        }

        const subscriptionFromInvoice = (invoice as any).subscription;
        let invSubscriptionId: string | null = null;
        if (typeof subscriptionFromInvoice === 'string') {
          invSubscriptionId = subscriptionFromInvoice;
        } else if (subscriptionFromInvoice && typeof subscriptionFromInvoice === 'object' && subscriptionFromInvoice.id) {
          invSubscriptionId = subscriptionFromInvoice.id;
        }

        if (!invSubscriptionId) {
          console.warn(`⚠️ Invoice ${invoice.id} paid, but no subscription ID found. Not a subscription renewal.`);
          return NextResponse.json({ received: true, warning: 'No subscription ID on invoice, not a renewal.' }, { status: 200 });
        }

        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(invSubscriptionId, {
            expand: ['items.data.price.product'],
          });

          let user;
          if (stripeSubscription.metadata.userId) {
            user = await prisma.user.findUnique({ where: { id: stripeSubscription.metadata.userId }});
          }
          
          if (!user) {
            // Fallback for older subscriptions or if metadata is missing
            user = await prisma.user.findFirst({
              where: { stripeCustomerId: invStripeCustomerId }
            });
          }

          if (!user) {
            console.error(`🔴 Error: User not found for invoice ${invoice.id}. Neither via subscription metadata nor customer ID.`);
            return NextResponse.json({ received: true, warning: `User not found for customer ${invStripeCustomerId}.` }, { status: 200 });
          }
          const userId = user.id;

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
            const userData = {
              subscriptionStatus: stripeSubscription.status,
              subscriptionPlan: planName,
            };
            console.log(`[DIAGNOSTIC] Updating user in invoice.payment_succeeded`, { userId, data: userData });
            await tx.user.update({
              where: { id: userId },
              data: userData,
            });

            await tx.subscription.updateMany({
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