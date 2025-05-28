import { NextRequest } from 'next/server';
import httpMocks from 'node-mocks-http';
import Stripe from 'stripe';

// Helper to create mock requests
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
const createMockRequest = (method: HttpMethod, body: any, headers?: Record<string, string>, rawBody?: string) => {
  const mockReq = httpMocks.createRequest<NextRequest>({
    method,
    url: '/api/stripe/webhooks',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body,
    _readableStream: rawBody ? Buffer.from(rawBody) : undefined, // for req.text()
  });
  // Mock req.text() for raw body retrieval
  mockReq.text = jest.fn().mockResolvedValue(rawBody || JSON.stringify(body));
  return mockReq as unknown as NextRequest;
};

describe('/api/stripe/webhooks', () => {
  let POST: any; // To hold the dynamically imported POST function
  const mockUserUpdate = jest.fn();
  const mockUserFindUnique = jest.fn(); // Added mock for prisma.user.findUnique
  const mockUserFindFirst = jest.fn(); // Added mock for prisma.user.findFirst
  const mockSubscriptionCreate = jest.fn();
  const mockSubscriptionUpdate = jest.fn();
  const mockSubscriptionUpsert = jest.fn();
  const mockSubscriptionUpdateMany = jest.fn();
  const mockStripeConstructEvent = jest.fn();
  const mockStripeSubscriptionsRetrieve = jest.fn(); // New mock for subscriptions.retrieve
  const mockStripeProductsRetrieve = jest.fn();    // New mock for products.retrieve
  const mockCreditServiceAddCredits = jest.fn(); // Mock for CreditService.addCredits
  const MOCK_WEBHOOK_SECRET = 'whsec_test_secret';
  const originalStripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.resetModules(); // Crucial for jest.doMock to work correctly on subsequent test runs

    // Mock CreditService *before* it might be imported by the route handler
    jest.doMock('@/lib/credit-service', () => ({
      CreditService: {
        addCredits: mockCreditServiceAddCredits,
      },
    }));

    // Mock the shared prisma instance from @/lib/db
    jest.doMock('@/lib/db', () => ({
      prisma: {
        user: {
          update: mockUserUpdate,
          findUnique: mockUserFindUnique, // Added here
          findFirst: mockUserFindFirst, // Added here
        },
        subscription: {
          create: mockSubscriptionCreate,
          update: mockSubscriptionUpdate,
          upsert: mockSubscriptionUpsert,
          updateMany: mockSubscriptionUpdateMany,
        },
        $transaction: jest.fn(async (callback) => callback(
          {
            user: {
              update: mockUserUpdate,
              findUnique: mockUserFindUnique, // And here for transactions
              findFirst: mockUserFindFirst, // And here for transactions
            },
            subscription: {
              upsert: mockSubscriptionUpsert,
              updateMany: mockSubscriptionUpdateMany,
            },
          }
        )),
      },
    }));

    // Set up mocks *before* requiring the module under test
    jest.doMock('../../../../../lib/stripe', () => ({
      stripe: {
        webhooks: {
          constructEvent: mockStripeConstructEvent,
        },
        subscriptions: { // Add subscriptions here
          retrieve: mockStripeSubscriptionsRetrieve,
        },
        products: { // Add products here
          retrieve: mockStripeProductsRetrieve,
        },
        errors: {
          StripeSignatureVerificationError: jest.fn(),
        },
      },
    }));

    // Dynamically require the module under test *after* mocks are established
    POST = require('../route').POST;

    // Reset spies/mocks for each test
    mockUserUpdate.mockReset();
    mockUserFindUnique.mockReset(); // Reset new mock
    mockUserFindFirst.mockReset(); // Reset new mock
    mockSubscriptionCreate.mockReset();
    mockSubscriptionUpdate.mockReset();
    mockSubscriptionUpsert.mockReset();
    mockSubscriptionUpdateMany.mockReset();
    mockStripeConstructEvent.mockReset();
    mockStripeSubscriptionsRetrieve.mockReset(); // Reset new mock
    mockStripeProductsRetrieve.mockReset();    // Reset new mock
    mockCreditServiceAddCredits.mockReset(); // Reset CreditService mock
    process.env.STRIPE_WEBHOOK_SECRET = MOCK_WEBHOOK_SECRET;
  });

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalStripeWebhookSecret;
    jest.resetModules(); // Clean up modules after each test
  });

  describe('POST', () => {
    const mockEventPayload = { type: 'test.event', data: { object: {} } };
    const rawPayload = JSON.stringify(mockEventPayload);

    it('should return 405 if req.method is not POST (internal check)', async () => {
      const req = createMockRequest('GET', {});
      const response = await POST(req);
      const responseBody = await response.json();
      expect(response.status).toBe(405);
      expect(responseBody).toEqual({ error: 'Method Not Allowed' });
    });

    it('should return 400 if stripe-signature header is missing', async () => {
      const req = createMockRequest('POST', mockEventPayload, {}, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();
      expect(response.status).toBe(400);
      expect(responseBody.error).toContain('Webhook signature verification failed');
    });

    it('should return 400 if signature verification fails (e.g., invalid signature)', async () => {
      mockStripeConstructEvent.mockImplementation(() => {
        const error: any = new Error('Test signature verification error');
        error.type = 'StripeSignatureVerificationError';
        throw error;
      });

      const req = createMockRequest('POST', mockEventPayload, { 'stripe-signature': 'sig_invalid' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(400);
      expect(responseBody.error).toContain('Webhook signature verification failed: Test signature verification error');
      expect(mockStripeConstructEvent).toHaveBeenCalledWith(
        rawPayload,
        'sig_invalid',
        MOCK_WEBHOOK_SECRET
      );
    });

    it('should return 200 OK and { received: true, eventId: ... } if signature is valid and event is processed (mocked)', async () => {
      const mockConstructedEvent = { id: 'evt_test_12345', type: 'test.event.successful' };
      mockStripeConstructEvent.mockReturnValue(mockConstructedEvent);

      const req = createMockRequest('POST', mockEventPayload, { 'stripe-signature': 'sig_valid' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, eventId: mockConstructedEvent.id });
      expect(mockStripeConstructEvent).toHaveBeenCalledWith(
        rawPayload,
        'sig_valid',
        MOCK_WEBHOOK_SECRET
      );
    });

    it('should return 500 if a non-Stripe error occurs during processing', async () => {
      mockStripeConstructEvent.mockImplementation(() => {
        throw new Error('Some unexpected internal server error');
      });

      const req = createMockRequest('POST', mockEventPayload, { 'stripe-signature': 'sig_causes_internal_error' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(500);
      expect(responseBody).toEqual({ error: 'Webhook handler failed. View logs.' });
    });
  });

  // New describe block for checkout.session.completed event
  describe('checkout.session.completed event', () => {
    const userId = 'user_test_123';
    const stripeCustomerId = 'cus_test_456';
    const sessionId = 'cs_test_789';
    const subscriptionId = 'sub_test_id_for_simple_case';
    const productId = 'prod_basic';
    const paymentIntentId = 'pi_test_123';

    beforeEach(() => {
      mockUserUpdate.mockReset();
      mockUserFindFirst.mockReset();
      mockSubscriptionUpsert.mockReset();
      mockCreditServiceAddCredits.mockReset();
      mockStripeSubscriptionsRetrieve.mockReset();
      mockStripeProductsRetrieve.mockReset();
      mockCreditServiceAddCredits.mockResolvedValue({ success: true, newBalance: 10 });
      
      // Set up default return values for user mocks
      mockUserFindFirst.mockResolvedValue({ id: userId, stripeCustomerId });
      mockUserUpdate.mockResolvedValue({ id: userId, stripeCustomerId });
      mockSubscriptionUpsert.mockResolvedValue({ id: 'sub_123', userId, stripeSubscriptionId: subscriptionId });
    });

    it('should process subscription creation, add credits via CreditService, and update user/subscription records', async () => {
      const planName = 'Basic Plan';
      const planCredits = 10;
      const mockSessionEvent = {
        id: 'evt_test_checkout_sub',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            mode: 'subscription' as Stripe.Checkout.Session.Mode,
            customer: stripeCustomerId,
            subscription: subscriptionId,
            metadata: { userId },
          },
        },
      };
      mockStripeConstructEvent.mockReturnValue(mockSessionEvent);
      
      const mockExpandedProduct = { id: productId, name: planName, metadata: { credits: String(planCredits) } };
      const mockSubscriptionDetails = {
        id: subscriptionId, status: 'active', 
        customer: stripeCustomerId,
        items: { data: [{ price: { product: mockExpandedProduct, id: 'price_some_id'} }] },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as any;
      mockStripeSubscriptionsRetrieve.mockResolvedValue(mockSubscriptionDetails);
      
      mockUserUpdate.mockResolvedValue({ id: userId });
      mockSubscriptionUpsert.mockResolvedValue({ id: 'dbsub_123' });
      mockCreditServiceAddCredits.mockResolvedValue({ success: true, newBalance: planCredits });

      const rawPayload = JSON.stringify(mockSessionEvent.data.object);
      const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_valid_checkout' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, eventId: mockSessionEvent.id });
      
      expect(mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith(subscriptionId, { expand: ['items.data.price.product'] });
      expect(mockStripeProductsRetrieve).not.toHaveBeenCalled();

      expect(mockCreditServiceAddCredits).toHaveBeenCalledWith(
        userId,
        planCredits,
        'subscription_renewal',
        `Subscription renewal: ${planName}`,
        'subscription',
        subscriptionId,
        expect.objectContaining({
            planName,
            stripeSubscriptionId: subscriptionId,
        })
      );
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          stripeCustomerId: stripeCustomerId,
          subscriptionStatus: 'active',
          subscriptionPlan: planName,
        },
      });
      expect(mockSubscriptionUpsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { stripeSubscriptionId: subscriptionId },
        create: expect.objectContaining({ monthlyCredits: planCredits }),
        update: expect.objectContaining({ monthlyCredits: planCredits }),
      }));
    });

    it('should process one-time payment if metadata.credits_purchased is present', async () => {
      const creditsToPurchase = 25;
      const mockSessionEvent = {
        id: 'evt_test_checkout_payment_credits_meta',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            mode: 'payment' as Stripe.Checkout.Session.Mode,
            customer: stripeCustomerId,
            metadata: { userId, credits_purchased: String(creditsToPurchase) },
            payment_intent: paymentIntentId,
            amount_total: 2500,
          },
        },
      };
      mockStripeConstructEvent.mockReturnValue(mockSessionEvent);
      mockUserUpdate.mockResolvedValue({ id: userId });
      mockCreditServiceAddCredits.mockResolvedValue({ success: true, newBalance: creditsToPurchase });

      const rawPayload = JSON.stringify(mockSessionEvent.data.object);
      const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_payment_credits_meta' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, eventId: mockSessionEvent.id });
      
      expect(mockCreditServiceAddCredits).toHaveBeenCalledWith(
        userId,
        creditsToPurchase,
        'purchased',
        `Credit purchase: ${creditsToPurchase} credits`,
        'subscription',
        sessionId,
        expect.objectContaining({
            sessionId: sessionId,
            stripeCustomerId,
            paymentMode: 'payment'
        })
      );
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: userId },
        data: { stripeCustomerId: stripeCustomerId }, 
      });
      expect(mockSubscriptionUpsert).not.toHaveBeenCalled();
    });
    
    it('should return 200 and {error: ...} if userId missing in metadata (subscription or payment)', async () => {
      const mockSessionEvent = {
        id: 'evt_test_checkout_no_user_sub',
        type: 'checkout.session.completed',
        data: { object: { id: sessionId, mode: 'subscription', customer: stripeCustomerId, subscription: subscriptionId, metadata: {} } },
      };
      mockStripeConstructEvent.mockReturnValue(mockSessionEvent);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockSessionEvent.data.object);
      const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_no_user' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, error: 'User ID missing in metadata' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('🔴 Error: userId not found in session metadata.', { sessionId: sessionId });
      expect(mockCreditServiceAddCredits).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should return 200 and {error: ...} if credits_purchased is invalid in metadata (payment mode)', async () => {
        const mockSessionEvent = {
            id: 'evt_test_checkout_invalid_credits_meta',
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: sessionId, mode: 'payment' as Stripe.Checkout.Session.Mode, customer: stripeCustomerId,
                    metadata: { userId, credits_purchased: 'not-a-number' },
                    payment_intent: paymentIntentId,
                },
            },
        };
        mockStripeConstructEvent.mockReturnValue(mockSessionEvent);
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const rawPayload = JSON.stringify(mockSessionEvent.data.object);
        const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_invalid_credits_meta' }, rawPayload);
        const response = await POST(req);
        const responseBody = await response.json();

        expect(response.status).toBe(200);
        expect(responseBody).toEqual({ received: true, error: 'Invalid credits_purchased in metadata' });
        expect(consoleErrorSpy).toHaveBeenCalledWith('🔴 Error: Invalid credits_purchased value.', { sessionId: sessionId, val: 'not-a-number' });
        expect(mockCreditServiceAddCredits).not.toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });

    it('should log warning if credits_purchased is missing in metadata (payment mode) and not call addCredits', async () => {
        const mockSessionEvent = {
            id: 'evt_test_checkout_missing_credits_meta',
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: sessionId, mode: 'payment' as Stripe.Checkout.Session.Mode, customer: stripeCustomerId,
                    metadata: { userId },
                    payment_intent: paymentIntentId,
                },
            },
        };
        mockStripeConstructEvent.mockReturnValue(mockSessionEvent);
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const rawPayload = JSON.stringify(mockSessionEvent.data.object);
        const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_missing_credits_meta' }, rawPayload);
        const response = await POST(req);
        const responseBody = await response.json();

        expect(response.status).toBe(200);
        expect(responseBody).toEqual({ received: true, eventId: mockSessionEvent.id });
        expect(consoleWarnSpy).toHaveBeenCalledWith(`⚠️ checkout.session.completed in payment mode for user ${userId} but no 'credits_purchased' in metadata. Session ID: ${sessionId}`);
        expect(mockCreditServiceAddCredits).not.toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
    });

    it('should return 200 and {error: Database update failed} if CreditService/Prisma fails (subscription)', async () => {
      const mockSessionEvent = {
        id: 'evt_test_checkout_sub_db_fail',
        type: 'checkout.session.completed',
        data: { object: { id: sessionId, mode: 'subscription', customer: stripeCustomerId, subscription: subscriptionId, metadata: { userId } } },
      };
      mockStripeConstructEvent.mockReturnValue(mockSessionEvent);
      const mockExpandedProduct = { id: productId, name: 'Fail Plan', metadata: { credits: '30' } };
      mockStripeSubscriptionsRetrieve.mockResolvedValue({ id: subscriptionId, status: 'active', customer: stripeCustomerId, items: { data: [{ price: { product: mockExpandedProduct, id: 'price_fail_id'} }] } } as any);
      
      const dbError = new Error('Prisma explosion during transaction');
      const { prisma: mockPrisma } = jest.requireMock('@/lib/db');
      (mockPrisma.$transaction as jest.Mock).mockRejectedValueOnce(dbError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockSessionEvent.data.object);
      const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_sub_db_fail' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, error: 'Database update failed' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(`🔴 Database error processing checkout.session.completed for user ${userId}:`, dbError.message, { sessionId: sessionId });
      consoleErrorSpy.mockRestore();
    });

    it('CreditService.addCredits fails AFTER successful DB transaction (subscription)', async () => {
      const planName = 'Basic Plan';
      const planCredits = 10;
      const mockSessionEvent = {
        id: 'evt_checkout_sub_creditsvc_fail_after_db',
        type: 'checkout.session.completed',
        data: { object: { id: sessionId, mode: 'subscription', customer: stripeCustomerId, subscription: subscriptionId, metadata: { userId } } },
      };
      mockStripeConstructEvent.mockReturnValue(mockSessionEvent);
      const mockExpandedProduct = { id: productId, name: planName, metadata: { credits: String(planCredits) } };
      mockStripeSubscriptionsRetrieve.mockResolvedValue({ id: subscriptionId, status: 'active', customer: stripeCustomerId, items: { data: [{ price: { product: mockExpandedProduct, id: 'price_some_id'} }] } } as any);
      mockUserUpdate.mockResolvedValue({ id: userId });
      mockSubscriptionUpsert.mockResolvedValue({ id: 'dbsub_123' });
      const { prisma: mockPrisma } = jest.requireMock('@/lib/db');
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(mockPrisma));

      const creditServiceError = new Error('CreditService failed post-DB');
      mockCreditServiceAddCredits.mockRejectedValue(creditServiceError);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockSessionEvent.data.object);
      const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_creditsvc_fail_after_db' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, error: 'Database update failed' }); 
      expect(mockCreditServiceAddCredits).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(`🔴 Database error processing checkout.session.completed for user ${userId}:`, creditServiceError.message, { sessionId: sessionId });
      consoleErrorSpy.mockRestore();
    });

  });

  // Describe block for customer.subscription.updated and customer.subscription.created events
  describe('customer.subscription.updated and customer.subscription.created events', () => {
    const stripeCustomerId = 'cus_sub_test_customer';
    const userId = 'user_sub_test_user';
    const subscriptionId = 'sub_test_id_for_live_events';
    const productId = 'prod_live_sub_product';
    const priceId = 'price_live_sub_product';
    const planName = 'Standard Plan';
    const planCredits = 75;

    beforeEach(() => {
      mockUserUpdate.mockReset();
      mockUserFindFirst.mockReset();
      mockSubscriptionUpsert.mockReset();
      mockSubscriptionUpdateMany.mockReset();
      mockCreditServiceAddCredits.mockReset();
      mockStripeProductsRetrieve.mockReset();
      // mockStripeSubscriptionsRetrieve is part of the global beforeEach, reset if specifically needed

      // Default mocks for this block
      mockUserFindFirst.mockResolvedValue({ id: userId, stripeCustomerId: stripeCustomerId, credits: 0, email: 'user@example.com' });
      mockStripeProductsRetrieve.mockResolvedValue({ id: productId, name: planName, metadata: { credits: String(planCredits) } } as any);
      mockCreditServiceAddCredits.mockResolvedValue({ success: true, newBalance: planCredits });
      mockSubscriptionUpsert.mockResolvedValue({ id: 'dbsub_live_event' });
      mockSubscriptionUpdateMany.mockResolvedValue({ count: 1 });
      mockUserUpdate.mockResolvedValue({ id: userId });
    });

    it('customer.subscription.created: should add credits and update user/subscription records', async () => {
      const mockSubscriptionObject = {
        id: subscriptionId,
        customer: stripeCustomerId,
        status: 'active',
        items: { data: [{ price: { product: productId, id: priceId } }] },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
        metadata: {}, // Assuming userId is not in subscription metadata here, relies on customer lookup
      } as any;
      const mockEvent = {
        id: 'evt_sub_created_live',
        type: 'customer.subscription.created',
        data: { object: mockSubscriptionObject },
      };
      mockStripeConstructEvent.mockReturnValue(mockEvent);

      const rawPayload = JSON.stringify(mockEvent.data.object); // Or full event for constructEvent
      const req = createMockRequest('POST', mockEvent.data.object, { 'stripe-signature': 'sig_sub_created' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, eventId: mockEvent.id });
      expect(mockUserFindFirst).toHaveBeenCalledWith({ where: { stripeCustomerId } });
      expect(mockStripeProductsRetrieve).toHaveBeenCalledWith(productId);
      expect(mockCreditServiceAddCredits).toHaveBeenCalledWith(
        userId,
        planCredits,
        'subscription_created',
        `Credits for new ${planName} subscription`,
        'subscription',
        subscriptionId,
        expect.objectContaining({
          planName,
          stripeSubscriptionId: subscriptionId,
          status: 'active'
        })
      );
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: userId },
        data: { 
          stripeCustomerId: stripeCustomerId,
          subscriptionStatus: 'active', 
          subscriptionPlan: planName 
        },
      });
      expect(mockSubscriptionUpsert).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: subscriptionId },
        create: expect.objectContaining({ 
          userId, 
          planName, 
          status: 'active',
          monthlyCredits: planCredits,
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date)
        }),
        update: expect.objectContaining({ 
          planName, 
          status: 'active',
          monthlyCredits: planCredits,
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date)
        }),
      });
    });

    it('customer.subscription.updated: (e.g. status change to active) should add credits if applicable and update records', async () => {
      // Scenario: Subscription was trialing, now becomes active.
      const mockSubscriptionObject = {
        id: subscriptionId, customer: stripeCustomerId, status: 'active', // status changed to active
        items: { data: [{ price: { product: productId, id: priceId } }] },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
        metadata: {},
        previous_attributes: { status: 'trialing' }, // Indicates what changed
      } as any;
      const mockEvent = {
        id: 'evt_sub_updated_to_active',
        type: 'customer.subscription.updated',
        data: { object: mockSubscriptionObject },
      };
      mockStripeConstructEvent.mockReturnValue(mockEvent);
      // Assuming credits are given when it becomes active from trial
      mockCreditServiceAddCredits.mockResolvedValue({ success: true, newBalance: planCredits });


      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest('POST', mockEvent.data.object, { 'stripe-signature': 'sig_sub_updated' }, rawPayload);
      await POST(req);

      expect(mockUserFindFirst).toHaveBeenCalledWith({ where: { stripeCustomerId } });
      expect(mockStripeProductsRetrieve).toHaveBeenCalledWith(productId);
      // Check if your logic for 'subscription_updated' gives credits
      // For this test, we assume it does if status changes from trialing to active
      expect(mockCreditServiceAddCredits).toHaveBeenCalledWith(
        userId,
        planCredits,
        'subscription_activated', // or a more generic 'subscription_updated_credits'
        `Credits for activated ${planName} subscription`,
        'subscription',
        subscriptionId,
        expect.objectContaining({
          planName,
          stripeSubscriptionId: subscriptionId,
          status: 'active'
        })
      );
      expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({ 
        data: expect.objectContaining({ 
          stripeCustomerId: stripeCustomerId,
          subscriptionStatus: 'active', 
          subscriptionPlan: planName 
        }) 
      }));
      expect(mockSubscriptionUpsert).toHaveBeenCalled();
    });
    
    it('customer.subscription.updated: (e.g. plan change) should grant new credits if new plan has more', async () => {
      const newProductId = 'prod_premium_plan';
      const newPlanName = 'Premium Plan';
      const newPlanCredits = 200;
      const mockSubscriptionObject = {
        id: subscriptionId, customer: stripeCustomerId, status: 'active',
        items: { data: [{ price: { product: newProductId, id: 'price_premium' } }] }, // New product
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
        metadata: {},
        previous_attributes: { items: { data: [{ price: { product: productId } }] } }, // Indicates items changed
      } as any;
       mockStripeProductsRetrieve.mockResolvedValue({ id: newProductId, name: newPlanName, metadata: { credits: String(newPlanCredits) } } as any);
       mockCreditServiceAddCredits.mockResolvedValue({ success: true, newBalance: newPlanCredits });


      const mockEvent = {
        id: 'evt_sub_updated_plan_change', type: 'customer.subscription.updated', data: { object: mockSubscriptionObject },
      };
      mockStripeConstructEvent.mockReturnValue(mockEvent);

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest('POST', mockEvent.data.object, { 'stripe-signature': 'sig_sub_plan_change' }, rawPayload);
      await POST(req);

      expect(mockCreditServiceAddCredits).toHaveBeenCalledWith(
        userId,
        newPlanCredits, // Or the difference if you prorate or only add incremental
        'subscription_activated', // The actual behavior - treats plan change as activation
        `Credits for activated ${newPlanName} subscription`,
        'subscription',
        subscriptionId,
        expect.objectContaining({
          planName: newPlanName,
          stripeSubscriptionId: subscriptionId,
          status: 'active'
        })
      );
      expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({ 
        data: expect.objectContaining({ 
          stripeCustomerId: stripeCustomerId,
          subscriptionPlan: newPlanName,
          subscriptionStatus: 'active'
        }) 
      }));
      expect(mockSubscriptionUpsert).toHaveBeenCalled();
    });

    it('customer.subscription.deleted: should update user/subscription status, no credits added', async () => {
      const mockSubscriptionObject = {
        id: subscriptionId, customer: stripeCustomerId, status: 'canceled', // Key status
        items: { data: [{ price: { product: productId, id: priceId } }] },
        metadata: {},
      } as any;
      const mockEvent = {
        id: 'evt_sub_deleted_live', type: 'customer.subscription.deleted', data: { object: mockSubscriptionObject },
      };
      mockStripeConstructEvent.mockReturnValue(mockEvent);

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest('POST', mockEvent.data.object, { 'stripe-signature': 'sig_sub_deleted' }, rawPayload);
      await POST(req);

      expect(mockUserFindFirst).toHaveBeenCalledWith({ where: { stripeCustomerId } });
      expect(mockCreditServiceAddCredits).not.toHaveBeenCalled();
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: userId },
        // Your app might set plan to null or keep old one, and status to canceled
        data: { subscriptionStatus: 'canceled' /*, subscriptionPlan: null */ },
      });
      expect(mockSubscriptionUpdateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: subscriptionId, userId: userId },
        data: { status: 'canceled' },
      });
    });

    it('should return 200, log error if user not found via stripeCustomerId', async () => {
      mockUserFindFirst.mockResolvedValue(null); // Simulate user not found
      const mockSubscriptionObject = { id: subscriptionId, customer: stripeCustomerId, status: 'active', items: { data: [{ price: { product: productId } }] } } as any;
      const mockEvent = { id: 'evt_sub_no_user', type: 'customer.subscription.created', data: { object: mockSubscriptionObject } };
      mockStripeConstructEvent.mockReturnValue(mockEvent);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest('POST', mockEvent.data.object, { 'stripe-signature': 'sig_sub_no_user' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual(expect.objectContaining({ warning: expect.stringContaining('User not found') }));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('User not found for stripeCustomerId'), expect.objectContaining({ subscriptionId }));
      expect(mockCreditServiceAddCredits).not.toHaveBeenCalled();
      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(mockSubscriptionUpsert).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should return 200, log error if CreditService.addCredits fails', async () => {
      const creditServiceError = new Error('CreditService.addCredits explosion');
      mockCreditServiceAddCredits.mockRejectedValue(creditServiceError);
      const mockSubscriptionObject = { id: subscriptionId, customer: stripeCustomerId, status: 'active', items: { data: [{ price: { product: productId, id: priceId } }] } } as any;
      const mockEvent = { id: 'evt_sub_credit_fail', type: 'customer.subscription.created', data: { object: mockSubscriptionObject } };
      mockStripeConstructEvent.mockReturnValue(mockEvent);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest('POST', mockEvent.data.object, { 'stripe-signature': 'sig_sub_credit_fail' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();
      
      expect(response.status).toBe(200);
      expect(responseBody).toEqual(expect.objectContaining({ error: 'Failed to process customer.subscription.created. View logs.', details: creditServiceError.message }));
      expect(mockCreditServiceAddCredits).toHaveBeenCalled(); // It was attempted
      // User/Subscription updates might still be attempted depending on handler logic
      expect(mockUserUpdate).toHaveBeenCalled(); 
      expect(mockSubscriptionUpsert).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error processing customer.subscription.created for subscription'), expect.any(String), expect.any(String));
      consoleErrorSpy.mockRestore();
    });
  });

  // Describe block for invoice.payment_succeeded events
  describe('invoice.payment_succeeded events', () => {
    const stripeCustomerId = 'cus_invoice_test_customer';
    const userId = 'user_invoice_test_user';
    const subscriptionId = 'sub_test_id_for_invoice_events';
    const invoiceId = 'in_test_id_for_invoice_events';
    const productId = 'prod_invoice_sub_product';
    const priceId = 'price_invoice_sub_product';
    const planName = 'Pro Plan - Invoice';
    const planCredits = 150;

    beforeEach(() => {
      mockUserUpdate.mockReset();
      mockUserFindFirst.mockReset();
      mockSubscriptionUpsert.mockReset();
      mockCreditServiceAddCredits.mockReset();
      mockStripeProductsRetrieve.mockReset();
      mockStripeSubscriptionsRetrieve.mockReset(); // Ensure this is reset

      // Default mocks for this block
      mockUserFindFirst.mockResolvedValue({ id: userId, stripeCustomerId: stripeCustomerId, credits: 0, email: 'user@example.com', subscriptions: [] });
      mockStripeProductsRetrieve.mockResolvedValue({ id: productId, name: planName, metadata: { credits: String(planCredits) } } as any);
      // Mock a subscription object that would be returned by stripe.subscriptions.retrieve
      mockStripeSubscriptionsRetrieve.mockResolvedValue({
        id: subscriptionId,
        status: 'active',
        items: { data: [{ price: { product: { id: productId, name: planName, metadata: { credits: String(planCredits) } }, id: priceId } }] },
        customer: stripeCustomerId,
        current_period_start: Math.floor(Date.now() / 1000) - (15 * 24 * 60 * 60), // in the past
        current_period_end: Math.floor(Date.now() / 1000) + (15 * 24 * 60 * 60), // upcoming
      } as any);
      mockCreditServiceAddCredits.mockResolvedValue({ success: true, newBalance: planCredits });
      mockSubscriptionUpsert.mockResolvedValue({ id: 'dbsub_invoice_event' });
      mockUserUpdate.mockResolvedValue({ id: userId });
    });

    it('should add credits and update records for a subscription renewal', async () => {
      const mockInvoiceObject = {
        id: invoiceId,
        customer: stripeCustomerId,
        subscription: subscriptionId, // Key: links to a subscription
        paid: true,
        status: 'paid',
        billing_reason: 'subscription_cycle', // or subscription_update, etc.
        lines: {
          data: [
            {
              price: { product: productId, id: priceId, type: 'recurring' },
              quantity: 1,
              period: { 
                start: Math.floor(Date.now() / 1000),
                end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
              }
            },
          ],
        },
        // Include other relevant fields like amount_paid if your handler uses them
        amount_paid: 2900, // e.g., $29.00
      } as any;
      const mockEvent = {
        id: 'evt_invoice_payment_succeeded_sub',
        type: 'invoice.payment_succeeded',
        data: { object: mockInvoiceObject },
      };
      mockStripeConstructEvent.mockReturnValue(mockEvent);

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest('POST', mockEvent.data.object, { 'stripe-signature': 'sig_invoice_paid_sub' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, eventId: mockEvent.id });
      expect(mockUserFindFirst).toHaveBeenCalledWith({ where: { stripeCustomerId }, include: { subscriptions: true } });
      // If invoice line items directly contain product ID, this might not be needed.
      // However, often one retrieves the subscription to be sure about the current plan.
      expect(mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith(subscriptionId, { expand: ['items.data.price.product'] });
      // Product info comes from expanded subscription, not separate call
      expect(mockStripeProductsRetrieve).not.toHaveBeenCalled();
      
      expect(mockCreditServiceAddCredits).toHaveBeenCalledWith(
        userId,
        planCredits,
        'invoice_payment_subscription_renewal',
        `Credits for ${planName} renewal (Invoice: ${invoiceId.substring(0, 10)}...)`,
        'invoice',
        invoiceId,
        expect.objectContaining({
          planName,
          stripeSubscriptionId: subscriptionId,
          invoiceId
        })
      );
      // User status might not change, but plan name could if it was an update
      expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ subscriptionPlan: planName, subscriptionStatus: 'active' }),
      }));
      expect(mockSubscriptionUpsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { stripeSubscriptionId: subscriptionId },
        create: expect.anything(), // Should ideally not be creating here if it's a renewal
        update: expect.objectContaining({
          status: 'active',
          planName: planName,
          currentPeriodStart: new Date(mockInvoiceObject.lines.data[0].period.start * 1000),
          currentPeriodEnd: new Date(mockInvoiceObject.lines.data[0].period.end * 1000),
        }),
      }));
    });

    it('should NOT add credits if invoice amount_paid is 0 (e.g., trial invoice)', async () => {
      const mockInvoiceObject = {
        id: invoiceId, customer: stripeCustomerId, subscription: subscriptionId, paid: true, status: 'paid',
        billing_reason: 'subscription_cycle', amount_paid: 0, // Key: amount_paid is 0
        lines: { data: [{ price: { product: productId, id: priceId }, period: {start: 1, end: 2} }] },
      } as any;
      const mockEvent = { id: 'evt_invoice_zero_amount', type: 'invoice.payment_succeeded', data: { object: mockInvoiceObject } };
      mockStripeConstructEvent.mockReturnValue(mockEvent);

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest('POST', mockEvent.data.object, { 'stripe-signature': 'sig_invoice_zero' }, rawPayload);
      await POST(req);

      expect(mockCreditServiceAddCredits).not.toHaveBeenCalled();
      // For $0 invoices, the implementation returns early and doesn't update user/subscription
      expect(mockUserUpdate).not.toHaveBeenCalled(); 
      expect(mockSubscriptionUpsert).not.toHaveBeenCalled(); 
    });

    it('should log warning and not add credits if subscription ID is missing from invoice', async () => {
        const mockInvoiceObject = { id: invoiceId, customer: stripeCustomerId, subscription: null, paid: true, status: 'paid', amount_paid: 500 } as any;
        const mockEvent = { id: 'evt_invoice_no_sub', type: 'invoice.payment_succeeded', data: { object: mockInvoiceObject } };
        mockStripeConstructEvent.mockReturnValue(mockEvent);
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const rawPayload = JSON.stringify(mockEvent.data.object);
        const req = createMockRequest('POST', mockEvent.data.object, { 'stripe-signature': 'sig_invoice_no_sub' }, rawPayload);
        await POST(req);

        expect(mockCreditServiceAddCredits).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invoice in_test_id_for_invoice_events payment succeeded but no subscription ID found'));
        consoleWarnSpy.mockRestore();
    });

    it('should return 200, log error if user not found by stripeCustomerId', async () => {
      mockUserFindFirst.mockResolvedValue(null);
      const mockInvoiceObject = { id: invoiceId, customer: stripeCustomerId, subscription: subscriptionId, paid: true, status: 'paid' } as any;
      const mockEvent = { id: 'evt_invoice_no_user', type: 'invoice.payment_succeeded', data: { object: mockInvoiceObject } };
      mockStripeConstructEvent.mockReturnValue(mockEvent);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest('POST', mockEvent.data.object, { 'stripe-signature': 'sig_invoice_no_user' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual(expect.objectContaining({ warning: expect.stringContaining('User not found') }));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('User not found for stripeCustomerId'));
      expect(mockCreditServiceAddCredits).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should return 200, log error if CreditService.addCredits fails', async () => {
      const creditServiceError = new Error('CreditService invoice explosion');
      mockCreditServiceAddCredits.mockRejectedValue(creditServiceError);
      const mockInvoiceObject = {
        id: invoiceId, customer: stripeCustomerId, subscription: subscriptionId, paid: true, status: 'paid', amount_paid: 3000,
        lines: { data: [{ price: { product: productId, id: priceId }, period: {start: 1, end: 2} }] },
      } as any;
      const mockEvent = { id: 'evt_invoice_credit_fail', type: 'invoice.payment_succeeded', data: { object: mockInvoiceObject } };
      mockStripeConstructEvent.mockReturnValue(mockEvent);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest('POST', mockEvent.data.object, { 'stripe-signature': 'sig_invoice_credit_fail' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, eventId: mockEvent.id, error: 'Failed to process invoice. View logs.', details: creditServiceError.message });
      expect(mockCreditServiceAddCredits).toHaveBeenCalled(); // Attempted
      // When CreditService fails, the entire try-catch block fails and DB updates don't happen
      expect(mockUserUpdate).not.toHaveBeenCalled(); 
      expect(mockSubscriptionUpsert).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error processing invoice.payment_succeeded for invoice'), expect.any(String), expect.any(String));
      consoleErrorSpy.mockRestore();
    });

  });
}); 