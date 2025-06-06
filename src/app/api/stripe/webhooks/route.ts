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
              
              // Safely convert timestamps to Date objects with validation
              const currentPeriodStart = typeof subPeriodStart === 'number' && !isNaN(subPeriodStart) 
                ? new Date(subPeriodStart * 1000) 
                : new Date();
              
              const currentPeriodEnd = typeof subPeriodEnd === 'number' && !isNaN(subPeriodEnd)
                ? new Date(subPeriodEnd * 1000)
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from now

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
            });

            // Add credits using CreditService for proper transaction logging
            // Safely convert timestamps to Date objects for the metadata
            const creditsPeriodStart = typeof (stripeSubscription as any).current_period_start === 'number' && !isNaN((stripeSubscription as any).current_period_start) 
              ? new Date((stripeSubscription as any).current_period_start * 1000) 
              : new Date();
            
            const creditsPeriodEnd = typeof (stripeSubscription as any).current_period_end === 'number' && !isNaN((stripeSubscription as any).current_period_end)
              ? new Date((stripeSubscription as any).current_period_end * 1000)
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              
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
                periodStart: creditsPeriodStart,
                periodEnd: creditsPeriodEnd
              },
              event.id // Pass Stripe event ID for idempotency
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

        // console.log(`[DEBUG] Processing ${event.type} for subscription ${subId}, customer ${subStripeCustomerId}`);

        if (!subStripeCustomerId) {
          console.error(`🔴 Error: Missing Stripe customer ID in ${event.type} event.`, { subscriptionId: subId });
          return NextResponse.json({ received: true, eventId: event.id, warning: 'Missing customer ID in subscription event.' }, { status: 200 });
        }

        try {
          const user = await prisma.user.findFirst({
            where: { stripeCustomerId: subStripeCustomerId },
          });

          if (!user) {
            console.error(`🔴 Error: User not found for stripeCustomerId ${subStripeCustomerId} in ${event.type}.`, { subscriptionId: subId });
            return NextResponse.json({ received: true, eventId: event.id, warning: `User not found for customer ${subStripeCustomerId}.` }, { status: 200 });
          }
          const userId = user.id;

          if (!subscription.items || !subscription.items.data || !subscription.items.data.length) {
            console.error(`🔴 Error: Subscription ${subId} has no items. Cannot determine plan/credits.`, { userId });
            return NextResponse.json({ received: true, eventId: event.id, warning: 'Subscription items missing.'}, { status: 200 });
          }

          const priceItem = subscription.items.data[0].price;
          if (!priceItem || typeof priceItem.product !== 'string') {
            console.error(`🔴 Error: Product ID missing or not a string in subscription item for ${subId}.`, { userId, priceId: priceItem?.id });
            return NextResponse.json({ received: true, eventId: event.id, warning: 'Product ID missing in subscription item.'}, { status: 200 });
          }
          const productId = priceItem.product;
          const stripeProduct = await stripe.products.retrieve(productId);

          const planName = stripeProduct.name;
          const creditsFromPlanString = stripeProduct.metadata?.credits || '0';
          const creditsToAllocate = parseInt(creditsFromPlanString, 10);

          if (isNaN(creditsToAllocate)) {
            console.error(`🔴 Error: Invalid credits value in product metadata for ${productId}.`, { userId, metadataValue: creditsFromPlanString });
            return NextResponse.json({ received: true, eventId: event.id, error: 'Invalid credits in product metadata' }, { status: 200 });
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

            // Safely convert timestamps to Date objects with robust validation
            let periodStart = new Date();
            let periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from now
            
            try {
              if (typeof (subscription as any).current_period_start === 'number' && 
                  !isNaN((subscription as any).current_period_start) && 
                  (subscription as any).current_period_start > 0) {
                // Valid timestamp - convert to date
                periodStart = new Date((subscription as any).current_period_start * 1000);
                // Extra validation - ensure date is not invalid
                if (isNaN(periodStart.getTime())) {
                  console.warn(`⚠️ Invalid date from subscription period start: ${(subscription as any).current_period_start}, using current date`);
                  periodStart = new Date();
                }
              } else {
                console.warn(`⚠️ Missing/invalid period start timestamp in subscription ${subId}, using current date`);
              }
              
              if (typeof (subscription as any).current_period_end === 'number' && 
                  !isNaN((subscription as any).current_period_end) && 
                  (subscription as any).current_period_end > 0) {
                // Valid timestamp - convert to date
                periodEnd = new Date((subscription as any).current_period_end * 1000);
                // Extra validation - ensure date is not invalid and is after start date
                if (isNaN(periodEnd.getTime())) {
                  console.warn(`⚠️ Invalid date from subscription period end: ${(subscription as any).current_period_end}, using fallback`);
                  periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
                } else if (periodEnd <= periodStart) {
                  console.warn(`⚠️ Period end (${periodEnd}) not after period start (${periodStart}), using fallback`);
                  periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
                }
              } else {
                console.warn(`⚠️ Missing/invalid period end timestamp in subscription ${subId}, using fallback`);
              }
            } catch (dateError) {
              console.error(`🔴 Error processing subscription period dates for ${subId}:`, dateError);
              // Keep default dates set above
            }

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
          });

          // Determine credit allocation logic based on event type and subscription status
          let shouldAddCredits = false;
          let creditReason = '';
          let creditTransactionType: string = 'subscription_updated'; // Using string type temporarily

          if (event.type === 'customer.subscription.created' && subscription.status === 'active') {
            shouldAddCredits = true;
            creditReason = `Credits for new ${planName} subscription`;
            creditTransactionType = 'subscription_created';
          } else if (event.type === 'customer.subscription.updated') {
            const previousStatus = (event.data.previous_attributes as any)?.status;
            if (subscription.status === 'active' && previousStatus !== 'active') {
                shouldAddCredits = true;
                creditReason = `Credits for activated ${planName} subscription`;
                creditTransactionType = 'subscription_activated';
            } else if (subscription.status === 'active') {
                 if (creditsToAllocate > 0) {
                    shouldAddCredits = true; 
                    creditReason = `Credits for updated ${planName} subscription`;
                    // creditTransactionType is already 'subscription_updated'
                 }
            }
          }
          if (subscription.status !== 'active' && subscription.status !== 'past_due') { 
            shouldAddCredits = false;
          }

          if (shouldAddCredits && creditsToAllocate > 0) {
            await CreditService.addCredits(
              userId,
              creditsToAllocate,
              creditTransactionType as any, // Cast to any to bypass enum issue for now
              creditReason,
              'subscription',
              subId,
              { planName, stripeSubscriptionId: subId, status: subscription.status },
              event.id // Pass Stripe event ID for idempotency
            );
            console.log(`✅ Credits added for user ${userId} via ${event.type}. Plan: ${planName}, Credits: ${creditsToAllocate}.`);
          } else {
            console.log(`ℹ️ No credits added for user ${userId} via ${event.type}. Status: ${subscription.status}, Credits: ${creditsToAllocate}.`);
          }
          console.log(`✅ ${event.type} for ${subId} processed for user ${userId}.`);

        } catch (err: any) {
          console.error(`🔴 Error processing ${event.type} for subscription ${subId}:`, err.message, err.stack);
          return NextResponse.json({ received: true, eventId: event.id, error: `Failed to process ${event.type}. View logs.` , details: err.message }, { status: 200 }); // 200 to Stripe
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
            await prisma.$transaction(async (tx) => {
                await tx.user.update({
                    where: { id: user.id },
                    data: { subscriptionStatus: deletedSubscription.status }, // e.g., 'canceled'
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
        // console.log(`[DEBUG] Processing invoice.payment_succeeded for invoice ${invoice.id}, customer ${invoice.customer}`);

        if (!invoice.customer || typeof invoice.customer !== 'string') {
          console.error('🔴 Error: Missing or invalid customer ID in invoice.payment_succeeded event.', { invoiceId: invoice.id });
          return NextResponse.json({ received: true, eventId: event.id, warning: 'Missing customer ID in invoice.' }, { status: 200 });
        }
        const invStripeCustomerId = invoice.customer;

        // Ignore $0 invoices (e.g., for trial periods or no actual charge)
        if (invoice.amount_paid === 0) {
          console.log(`ℹ️ Invoice ${invoice.id} for $0, no credits processed. Billing reason: ${invoice.billing_reason}`);
          // Potentially update subscription period if needed, even for $0 invoice that confirms a period
          if ((invoice as any).subscription && typeof (invoice as any).subscription === 'string' && invoice.lines && invoice.lines.data.length > 0) {
            const userForZeroInvoice = await prisma.user.findFirst({ where: { stripeCustomerId: invStripeCustomerId }});
            if (userForZeroInvoice) {
                const firstLineItem = invoice.lines.data[0];
                // Accessing line item properties - plan might be on price.product or price itself
                const planDetails = (firstLineItem as any).plan || ((firstLineItem as any).price as any)?.plan || (((firstLineItem as any).price as any)?.product as any)?.plan;
                if (firstLineItem.period && planDetails) { 
                    try {
                        // Safely convert period timestamps with comprehensive validation
                        let periodStart = new Date();
                        let periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                        
                        try {
                          // Validate and convert start timestamp
                          if (typeof firstLineItem.period.start === 'number' && 
                              !isNaN(firstLineItem.period.start) && 
                              firstLineItem.period.start > 0) {
                            const tempStart = new Date(firstLineItem.period.start * 1000);
                            if (!isNaN(tempStart.getTime())) {
                              periodStart = tempStart;
                            } else {
                              console.warn(`⚠️ Invalid period start for $0 invoice ${invoice.id}, using current date`);
                            }
                          } else {
                            console.warn(`⚠️ Missing/invalid period start for $0 invoice ${invoice.id}, using current date`);
                          }
                          
                          // Validate and convert end timestamp
                          if (typeof firstLineItem.period.end === 'number' && 
                              !isNaN(firstLineItem.period.end) && 
                              firstLineItem.period.end > 0) {
                            const tempEnd = new Date(firstLineItem.period.end * 1000);
                            if (!isNaN(tempEnd.getTime())) {
                              if (tempEnd <= periodStart) {
                                console.warn(`⚠️ Period end not after start for $0 invoice ${invoice.id}, using fallback`);
                                periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
                              } else {
                                periodEnd = tempEnd;
                              }
                            } else {
                              console.warn(`⚠️ Invalid period end for $0 invoice ${invoice.id}, using fallback`);
                            }
                          } else {
                            console.warn(`⚠️ Missing/invalid period end for $0 invoice ${invoice.id}, using fallback`);
                          }
                        } catch (dateError) {
                          console.error(`🔴 Error processing $0 invoice period dates for ${invoice.id}:`, dateError);
                          // Keep default dates set above
                        }
                            
                        await prisma.subscription.updateMany({
                            where: { stripeSubscriptionId: (invoice as any).subscription, userId: userForZeroInvoice.id },
                            data: {
                                currentPeriodStart: periodStart,
                                currentPeriodEnd: periodEnd,
                                status: 'active', // Or derive from invoice/subscription object if more accurate
                            },
                        });
                        console.log(`ℹ️ Subscription period updated for ${(invoice as any).subscription} due to $0 invoice ${invoice.id}.`);
                    } catch (periodUpdateError: any) {
                        console.error('🔴 Error updating subscription period for $0 invoice:', periodUpdateError.message);
                    }
                }
            }
          }
          return NextResponse.json({ received: true, eventId: event.id, message: '$0 invoice, no credits processed.' }, { status: 200 });
        }

        // Process only if there is a subscription ID, to tie credits to a subscription plan
        if (!(invoice as any).subscription || typeof (invoice as any).subscription !== 'string') {
          console.warn(`⚠️ Invoice ${invoice.id} payment succeeded but no subscription ID found. Credits not processed unless it's a recognized one-time purchase pattern (not yet implemented here).`);
          return NextResponse.json({ received: true, eventId: event.id, warning: 'No subscription ID on invoice, credits not processed.' }, { status: 200 });
        }
        const invSubscriptionId = (invoice as any).subscription as string;

        try {
          const user = await prisma.user.findFirst({ 
            where: { stripeCustomerId: invStripeCustomerId },
            include: { subscriptions: true } // Include subscriptions to access monthlyCredits
        });
          if (!user) {
            console.error(`🔴 Error: User not found for stripeCustomerId ${invStripeCustomerId} (from invoice ${invoice.id}).`);
            return NextResponse.json({ received: true, eventId: event.id, warning: `User not found for customer ${invStripeCustomerId}.` }, { status: 200 });
          }
          const userId = user.id;

          // Retrieve the subscription to get plan details, as invoice line items might not have all info
          const stripeSubscription = await stripe.subscriptions.retrieve(invSubscriptionId, {
            expand: ['items.data.price.product'],
          });

          if (!stripeSubscription || !stripeSubscription.items || !stripeSubscription.items.data.length) {
            console.error(`🔴 Error: Subscription ${invSubscriptionId} (from invoice ${invoice.id}) not found or has no items.`);
            return NextResponse.json({ received: true, eventId: event.id, warning: 'Subscription details not found for invoice.' }, { status: 200 });
          }

          const priceItem = stripeSubscription.items.data[0].price;
          const product = priceItem.product as Stripe.Product;
          const planName = product.name;
          const creditsFromPlanString = product.metadata?.credits || '0';
          const creditsToAllocate = parseInt(creditsFromPlanString, 10);

          if (isNaN(creditsToAllocate) || creditsToAllocate <= 0) {
            console.error(`🔴 Error: Invalid or zero credits in product metadata for ${product.id} (from invoice ${invoice.id}). Credits: ${creditsToAllocate}`);
            // Still update subscription period below, but don't add credits
          } else {
             // Add credits using CreditService
            await CreditService.addCredits(
                userId,
                creditsToAllocate,
                'subscription_renewal',
                `Credits for ${planName} renewal (Invoice: ${invoice.id?.substring(0, 10) || 'unknown'}...)`,
                'invoice' as any, // relatedEntityType - Cast for now, ensure enum is updated
                invoice.id || 'unknown', // relatedEntityId
                { planName, stripeSubscriptionId: invSubscriptionId, invoiceId: invoice.id },
                event.id // Pass Stripe event ID for idempotency
            );
            console.log(`✅ Credits added for user ${userId} from invoice ${invoice.id}. Plan: ${planName}, Credits: ${creditsToAllocate}.`);
          }

          // Update user and subscription records (especially period start/end from invoice line item)
          const invoiceLineItem = invoice.lines.data.find(line => (line as any).subscription === invSubscriptionId && (line as any).type === 'subscription') || invoice.lines.data[0];
          
          // Safely convert period timestamps with robust validation
          let invoicePeriodStart = new Date();
          let invoicePeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          
          try {
            if (invoiceLineItem.period) {
              // Process start date with comprehensive validation
              if (typeof invoiceLineItem.period.start === 'number' && 
                  !isNaN(invoiceLineItem.period.start) && 
                  invoiceLineItem.period.start > 0) {
                // Convert to date object
                const tempStart = new Date(invoiceLineItem.period.start * 1000);
                // Validate date is valid
                if (!isNaN(tempStart.getTime())) {
                  invoicePeriodStart = tempStart;
                } else {
                  console.warn(`⚠️ Invalid period start date in invoice ${invoice.id} line item, using current date`);
                }
              } else {
                console.warn(`⚠️ Missing/invalid period start in invoice ${invoice.id} line item, using current date`);
              }
              
              // Process end date with comprehensive validation
              if (typeof invoiceLineItem.period.end === 'number' && 
                  !isNaN(invoiceLineItem.period.end) && 
                  invoiceLineItem.period.end > 0) {
                // Convert to date object
                const tempEnd = new Date(invoiceLineItem.period.end * 1000);
                // Validate date is valid and after start date
                if (!isNaN(tempEnd.getTime())) {
                  if (tempEnd <= invoicePeriodStart) {
                    console.warn(`⚠️ Period end (${tempEnd}) not after period start (${invoicePeriodStart}) in invoice ${invoice.id}, using fallback`);
                    invoicePeriodEnd = new Date(invoicePeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
                  } else {
                    invoicePeriodEnd = tempEnd;
                  }
                } else {
                  console.warn(`⚠️ Invalid period end date in invoice ${invoice.id} line item, using fallback`);
                }
              } else {
                console.warn(`⚠️ Missing/invalid period end in invoice ${invoice.id} line item, using fallback`);
              }
            } else {
              console.warn(`⚠️ No period found in invoice ${invoice.id} line item, using default dates`);
            }
          } catch (dateError) {
            console.error(`🔴 Error processing invoice period dates for ${invoice.id}:`, dateError);
            // Keep default dates set above
          }
          
          await prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: userId },
              data: {
                stripeCustomerId: invStripeCustomerId,
                subscriptionStatus: stripeSubscription.status, // from retrieved subscription
                subscriptionPlan: planName,
              },
            });

            await tx.subscription.upsert({
              where: { stripeSubscriptionId: invSubscriptionId },
              create: {
                userId: userId,
                stripeSubscriptionId: invSubscriptionId,
                planName: planName,
                status: stripeSubscription.status,
                currentPeriodStart: invoicePeriodStart,
                currentPeriodEnd: invoicePeriodEnd,
                monthlyCredits: (creditsToAllocate >= 0 ? creditsToAllocate : 0),
              },
              update: {
                planName: planName,
                status: stripeSubscription.status,
                currentPeriodStart: invoicePeriodStart,
                currentPeriodEnd: invoicePeriodEnd,
                monthlyCredits: (creditsToAllocate >= 0 ? creditsToAllocate : undefined),
              },
            });
          });
          console.log(`✅ Invoice ${invoice.id} processed for user ${userId}. Subscription ${invSubscriptionId} updated.`);

        } catch (err: any) {
          console.error(`🔴 Error processing invoice.payment_succeeded for invoice ${invoice.id}:`, err.message, err.stack);
          return NextResponse.json({ received: true, eventId: event.id, error: 'Failed to process invoice. View logs.', details: err.message }, { status: 200 });
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