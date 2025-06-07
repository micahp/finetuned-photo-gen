import { 
  createMockRequest, 
  createMockServices, 
  setupMocks, 
  resetMocks, 
  setupEnvironment,
  expectSuccessfulResponse,
  type MockServices 
} from './utils/test-helpers.utils';
import { 
  createCheckoutSessionEvent, 
  createMockUser, 
  createMockProduct, 
  createMockSubscription,
  TEST_IDS, 
  TEST_PLANS 
} from './fixtures/webhook-events.fixtures';

describe('Stripe Webhook - checkout.session.completed', () => {
  let POST: any;
  let mocks: MockServices;
  let restoreEnvironment: () => void;

  beforeEach(() => {
    mocks = createMockServices();
    setupMocks(mocks);
    restoreEnvironment = setupEnvironment();
    
    POST = require('../route').POST;
    resetMocks(mocks);

    // Set up default successful responses
    mocks.mockUserFindFirst.mockResolvedValue(createMockUser());
    mocks.mockUserUpdate.mockResolvedValue(createMockUser());
    mocks.mockSubscriptionUpsert.mockResolvedValue({ 
      id: 'sub_123', 
      userId: TEST_IDS.userId, 
      stripeSubscriptionId: TEST_IDS.subscriptionId 
    });
    mocks.mockCreditServiceAddCredits.mockResolvedValue({ 
      success: true, 
      newBalance: TEST_PLANS.basic.credits 
    });
  });

  afterEach(() => {
    restoreEnvironment();
    jest.resetModules();
  });

  describe('Subscription Mode', () => {
    it('should process subscription creation and add credits', async () => {
      const mockEvent = createCheckoutSessionEvent();
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);
      
      const mockSubscriptionDetails = createMockSubscription({
        items: {
          data: [{
            price: {
              product: createMockProduct('basic'),
              id: TEST_IDS.priceId,
            },
          }],
        },
      });
      mocks.mockStripeSubscriptionsRetrieve.mockResolvedValue(mockSubscriptionDetails);

      // Mock the user.update to return the user with incremented credits
      mocks.mockUserUpdate.mockResolvedValue({
        ...createMockUser(),
        credits: TEST_PLANS.basic.credits
      });

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_valid_checkout' }, 
        rawPayload
      );
      const response = await POST(req);

      await expectSuccessfulResponse(response, mockEvent.id);
      
      expect(mocks.mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith(
        TEST_IDS.subscriptionId, 
        { expand: ['items.data.price.product'] }
      );
      
      // Credit allocation now happens inside transaction, not via CreditService
      expect(mocks.mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_IDS.userId },
          data: expect.objectContaining({
            subscriptionStatus: 'active',
            subscriptionPlan: TEST_PLANS.basic.name,
            stripeCustomerId: TEST_IDS.stripeCustomerId,
          }),
        })
      );
      
      expect(mocks.mockSubscriptionUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripeSubscriptionId: TEST_IDS.subscriptionId },
          create: expect.objectContaining({ 
            monthlyCredits: TEST_PLANS.basic.credits 
          }),
          update: expect.objectContaining({ 
            monthlyCredits: TEST_PLANS.basic.credits 
          }),
        })
      );
    });

    it('should return error if userId missing in metadata', async () => {
      const mockEvent = createCheckoutSessionEvent({
        metadata: {}, // No userId
      });
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_no_user' }, 
        rawPayload
      );
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ 
        received: true, 
        error: 'User ID missing in metadata' 
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '🔴 Error: userId not found in session metadata.', 
        { sessionId: TEST_IDS.sessionId }
      );
      expect(mocks.mockCreditServiceAddCredits).not.toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle database errors gracefully', async () => {
      const mockEvent = createCheckoutSessionEvent();
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);
      
      const mockSubscriptionDetails = createMockSubscription({
        items: {
          data: [{
            price: {
              product: createMockProduct('basic'),
              id: TEST_IDS.priceId,
            },
          }],
        },
      });
      mocks.mockStripeSubscriptionsRetrieve.mockResolvedValue(mockSubscriptionDetails);
      
      const dbError = new Error('Database connection failed');
      const { prisma: mockPrisma } = jest.requireMock('@/lib/db');
      (mockPrisma.$transaction as jest.Mock).mockRejectedValueOnce(dbError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_db_fail' }, 
        rawPayload
      );
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ 
        received: true, 
        error: 'Database update failed' 
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `🔴 Database error processing checkout.session.completed for user ${TEST_IDS.userId}:`,
        dbError.message,
        { sessionId: TEST_IDS.sessionId }
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Payment Mode', () => {
    it('should process one-time credit purchase', async () => {
      const creditsToPurchase = 25;
      const mockEvent = createCheckoutSessionEvent({
        mode: 'payment',
        subscription: undefined,
        metadata: { 
          userId: TEST_IDS.userId, 
          credits_purchased: String(creditsToPurchase) 
        },
        payment_intent: TEST_IDS.paymentIntentId,
        amount_total: 2500,
      });
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_payment_credits' }, 
        rawPayload
      );
      const response = await POST(req);

      await expectSuccessfulResponse(response, mockEvent.id);
      
      expect(mocks.mockCreditServiceAddCredits).toHaveBeenCalledWith(
        TEST_IDS.userId,
        creditsToPurchase,
        'purchased',
        `Credit purchase: ${creditsToPurchase} credits`,
        'subscription',
        TEST_IDS.sessionId,
        expect.objectContaining({
          sessionId: TEST_IDS.sessionId,
          stripeCustomerId: TEST_IDS.stripeCustomerId,
          paymentMode: 'payment'
        }),
        expect.any(String) // Event ID
      );
      
      expect(mocks.mockUserUpdate).toHaveBeenCalledWith({
        where: { id: TEST_IDS.userId },
        data: { stripeCustomerId: TEST_IDS.stripeCustomerId }, 
      });
      
      expect(mocks.mockSubscriptionUpsert).not.toHaveBeenCalled();
    });

    it('should return error if credits_purchased is invalid', async () => {
      const mockEvent = createCheckoutSessionEvent({
        mode: 'payment',
        subscription: undefined,
        metadata: { 
          userId: TEST_IDS.userId, 
          credits_purchased: 'not-a-number' 
        },
        payment_intent: TEST_IDS.paymentIntentId,
      });
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_invalid_credits' }, 
        rawPayload
      );
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ 
        received: true, 
        error: 'Invalid credits_purchased in metadata' 
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '🔴 Error: Invalid credits_purchased value.', 
        { sessionId: TEST_IDS.sessionId, val: 'not-a-number' }
      );
      expect(mocks.mockCreditServiceAddCredits).not.toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should log warning if credits_purchased is missing', async () => {
      const mockEvent = createCheckoutSessionEvent({
        mode: 'payment',
        subscription: undefined,
        metadata: { userId: TEST_IDS.userId }, // No credits_purchased
        payment_intent: TEST_IDS.paymentIntentId,
      });
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_missing_credits' }, 
        rawPayload
      );
      const response = await POST(req);

      await expectSuccessfulResponse(response, mockEvent.id);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `⚠️ checkout.session.completed in payment mode for user ${TEST_IDS.userId} but no 'credits_purchased' in metadata. Session ID: ${TEST_IDS.sessionId}`
      );
      expect(mocks.mockCreditServiceAddCredits).not.toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });
  });
}); 