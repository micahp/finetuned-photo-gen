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
  const mockSubscriptionCreate = jest.fn();
  const mockSubscriptionUpdate = jest.fn();
  const mockSubscriptionUpsert = jest.fn();
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
        },
        subscription: {
          create: mockSubscriptionCreate,
          update: mockSubscriptionUpdate,
          upsert: mockSubscriptionUpsert,
        },
        $transaction: jest.fn(async (callback) => callback(
          {
            user: {
              update: mockUserUpdate,
            },
            subscription: {
              upsert: mockSubscriptionUpsert,
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
    mockSubscriptionCreate.mockReset();
    mockSubscriptionUpdate.mockReset();
    mockSubscriptionUpsert.mockReset();
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

    it('should process subscription creation successfully', async () => {
      const mockSessionEvent = {
        id: 'evt_test_checkout_sub',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            mode: 'subscription' as Stripe.Checkout.Session.Mode,
            customer: stripeCustomerId,
            subscription: 'sub_test_id_for_simple_case',
            metadata: { userId },
          },
        },
      };
      mockStripeConstructEvent.mockReturnValue(mockSessionEvent);
      const planName = 'Basic Plan';
      const planCredits = 10;
      const mockProduct = { id: 'prod_basic', name: planName, metadata: { credits: String(planCredits) } } as any;
      const mockSubscription = {
        id: 'sub_basic_test',
        status: 'active',
        items: { data: [{ price: { product: mockProduct } }] },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      } as any;
      mockStripeSubscriptionsRetrieve.mockResolvedValue(mockSubscription);
      mockUserUpdate.mockResolvedValue({ id: userId, credits: 0 });
      mockSubscriptionUpsert.mockResolvedValue({ id: 'dbsub_123' }); // For the transaction

      const rawPayload = JSON.stringify(mockSessionEvent.data.object);
      const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_valid_checkout' }, rawPayload);
      
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, eventId: mockSessionEvent.id });

      // Verify CreditService.addCredits was called
      expect(mockCreditServiceAddCredits).toHaveBeenCalledWith(
        userId,
        planCredits,
        'subscription_renewal', // or a more specific type if you have one for new subscriptions
        `Subscription to ${planName}`,
        'subscription',
        mockSessionEvent.data.object.subscription
      );

      // Verify user update for non-credit fields
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          stripeCustomerId: stripeCustomerId,
          subscriptionStatus: 'active',
          subscriptionPlan: planName,
          // DO NOT check for credits increment here anymore
        },
      });

      expect(mockSubscriptionUpsert).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_basic_test' },
        create: {
          userId: userId,
          stripeSubscriptionId: 'sub_basic_test',
          planName: planName,
          status: 'active',
          currentPeriodStart: new Date(mockSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(mockSubscription.current_period_end * 1000),
          monthlyCredits: planCredits,
        },
        update: {
          status: 'active',
          planName: planName,
          currentPeriodStart: new Date(mockSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(mockSubscription.current_period_end * 1000),
          monthlyCredits: planCredits,
        },
      });
    });

    it('should process one-time payment (credits) successfully', async () => {
      const creditsToPurchase = 100;
      const mockSessionEvent = {
        id: 'evt_test_checkout_payment',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            mode: 'payment',
            customer: stripeCustomerId,
            metadata: { userId, credits_purchased: String(creditsToPurchase) },
          },
        },
      };
      mockStripeConstructEvent.mockReturnValue(mockSessionEvent);
      mockUserUpdate.mockResolvedValue({ id: userId, credits: creditsToPurchase });

      const rawPayload = JSON.stringify(mockSessionEvent.data.object);
      const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_valid_checkout' }, rawPayload);

      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, eventId: mockSessionEvent.id });

      // Verify CreditService.addCredits was called
      expect(mockCreditServiceAddCredits).toHaveBeenCalledWith(
        userId,
        creditsToPurchase,
        'purchased',
        'One-time credit purchase',
        'payment',
        mockSessionEvent.data.object.id // Use session ID as relatedEntityId for one-time payments
      );

      // Verify user update for non-credit fields (e.g., stripeCustomerId)
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          stripeCustomerId: stripeCustomerId,
        },
      });
    });

    it('should return 200 and log error if userId is missing in metadata', async () => {
      const mockSessionEvent = {
        id: 'evt_test_checkout_no_user',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            mode: 'subscription' as Stripe.Checkout.Session.Mode,
            customer: stripeCustomerId,
            subscription: 'sub_no_user_test',
            metadata: {},
          } as any,
        },
      };
      mockStripeConstructEvent.mockReturnValue(mockSessionEvent);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockSessionEvent.data.object);
      const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_valid_checkout_no_user' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, error: 'User ID missing in metadata' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '🔴 Error: userId not found in session metadata.',
        { sessionId: mockSessionEvent.data.object.id }
      );
      expect(mockCreditServiceAddCredits).not.toHaveBeenCalled();
      expect(mockUserUpdate).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should return 200 and log error if Prisma update fails', async () => {
      const mockSessionEvent = {
        id: 'evt_test_checkout_prisma_fail',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            mode: 'subscription' as Stripe.Checkout.Session.Mode,
            customer: stripeCustomerId,
            subscription: 'sub_prisma_fail_test_id',
            metadata: { userId },
          } as any,
        },
      };
      mockStripeConstructEvent.mockReturnValue(mockSessionEvent);

      const planName = 'Prisma Fail Plan';
      const planCredits = 15;
      const mockProductForPrismaFail = { id: 'prod_prisma_fail', name: planName, metadata: { credits: String(planCredits) } } as any;
      const mockSubscriptionForPrismaFail = {
        id: 'sub_prisma_fail_test_id',
        status: 'active',
        items: { data: [{ price: { product: mockProductForPrismaFail } }] },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      } as any;
      mockStripeSubscriptionsRetrieve.mockResolvedValue(mockSubscriptionForPrismaFail);

      const prismaError = new Error('Simulated Prisma Error in transaction');
      const { prisma: mockPrisma } = jest.requireMock('@/lib/db');
      (mockPrisma.$transaction as jest.Mock).mockImplementationOnce(async () => {
        throw prismaError;
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockSessionEvent.data.object);
      const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_valid_checkout_prisma_fail' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, error: 'Database update failed' });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `🔴 Database error processing checkout.session.completed for user ${userId}:`,
        prismaError.message,
        { sessionId: mockSessionEvent.data.object.id }
      );

      consoleErrorSpy.mockRestore();
    });

    it('should return 200 and log error for invalid credits_purchased metadata in payment mode', async () => {
      const mockSessionEvent = {
        id: 'evt_test_checkout_invalid_credits',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            mode: 'payment',
            customer: stripeCustomerId,
            metadata: { userId, credits_purchased: 'not-a-number' },
          },
        },
      };
      mockStripeConstructEvent.mockReturnValue(mockSessionEvent);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockSessionEvent.data.object);
      const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_valid_checkout' }, rawPayload);

      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, error: 'Invalid credits_purchased in metadata' });
      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '🔴 Error: Invalid credits_purchased value.',
        { sessionId: sessionId, val: 'not-a-number' }
      );
      consoleErrorSpy.mockRestore();
    });

    it('should return 200 and log warning if credits_purchased is missing in payment mode metadata', async () => {
      const mockSessionEvent = {
        id: 'evt_test_checkout_missing_credits',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            mode: 'payment',
            customer: stripeCustomerId,
            metadata: { userId }, // Missing credits_purchased
          },
        },
      };
      mockStripeConstructEvent.mockReturnValue(mockSessionEvent);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockSessionEvent.data.object);
      const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_valid_checkout' }, rawPayload);

      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, eventId: mockSessionEvent.id }); // No specific error in response body for this case
      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `⚠️ checkout.session.completed in payment mode for user ${userId} but no 'credits_purchased' in metadata. Session ID: ${sessionId}`
      );
      consoleWarnSpy.mockRestore();
    });

    it('should create a Subscription record and allocate credits for a new subscription', async () => {
      // Define constants used in this test scope
      const userId = 'user_test_123';
      const stripeCustomerId = 'cus_test_456';
      const sessionId = 'cs_test_789';
      const planCredits = 50;
      const subscriptionId = 'sub_new_test_id';
      const priceId = 'price_new_test_id';
      const productId = 'prod_new_test_id';
      const planName = 'Pro Plan';
      const currentTime = Math.floor(Date.now() / 1000);

      // Restore original console.log for this test if it was spied on globally and then restored
      // This is just to be sure, though jest.setup.js change should be enough
      const originalConsoleLog = console.log;
      // console.log = jest.fn(); // If you want to spy specific to this test, but we removed global mock for now

      const mockCheckoutSession = {
        id: sessionId,
        mode: 'subscription',
        customer: stripeCustomerId,
        subscription: subscriptionId, 
        metadata: { userId },
      } as any; // Cast to any for simplicity if full Checkout.Session type is too much

      const mockStripeProduct = {
        id: productId,
        name: planName,
        object: 'product', // common Stripe pattern
        // active: true, // only if your code actually uses it
        metadata: { credits: String(planCredits) }
      } as any; // Cast to any

      const mockStripeSubscription = {
        id: subscriptionId,
        status: 'active',
        object: 'subscription', // common Stripe pattern
        items: {
          data: [{
            price: {
              product: mockStripeProduct, // Embed the product mock (already 'any')
            },
          }],
        },
        current_period_start: currentTime,
        current_period_end: currentTime + (30 * 24 * 60 * 60),
      } as any; // Cast to any

      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_test_checkout_sub_create',
        type: 'checkout.session.completed',
        data: { object: mockCheckoutSession }, // mockCheckoutSession is already 'any'
        // Add other fields if Stripe.Event type strictly requires them and they are used by the code
        // For now, assume this is enough for constructEvent mock
      } as any); // Cast to any
      
mockStripeSubscriptionsRetrieve.mockResolvedValue(mockStripeSubscription);
      
mockUserUpdate.mockResolvedValue({ id: userId } as any); 
      mockSubscriptionUpsert.mockResolvedValue({ id: 'db_sub_id_123' } as any);

      const rawPayload = JSON.stringify(mockCheckoutSession);
      const req = createMockRequest('POST', mockCheckoutSession, { 'stripe-signature': 'sig_valid_new_sub' }, rawPayload);

      await POST(req);

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          stripeCustomerId: stripeCustomerId,
          subscriptionStatus: 'active',
          subscriptionPlan: planName,
          credits: { increment: planCredits },
        },
      });

      expect(mockSubscriptionUpsert).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: subscriptionId },
        create: {
          userId: userId,
          stripeSubscriptionId: subscriptionId,
          planName: planName,
          status: 'active',
          currentPeriodStart: new Date(mockStripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(mockStripeSubscription.current_period_end * 1000),
          monthlyCredits: planCredits,
        },
        update: {
          status: 'active',
          planName: planName,
          currentPeriodStart: new Date(mockStripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(mockStripeSubscription.current_period_end * 1000),
          monthlyCredits: planCredits,
        },
      });
      // console.log = originalConsoleLog; // Restore if spied locally
    });
  });
}); 