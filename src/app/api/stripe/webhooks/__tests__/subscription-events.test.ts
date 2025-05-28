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
  createSubscriptionEvent, 
  createMockUser, 
  createMockProduct,
  TEST_IDS, 
  TEST_PLANS 
} from './fixtures/webhook-events.fixtures';

describe('Stripe Webhook - Subscription Events', () => {
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
    mocks.mockSubscriptionUpsert.mockResolvedValue({ id: 'dbsub_live_event' });
    mocks.mockSubscriptionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.mockStripeProductsRetrieve.mockResolvedValue(createMockProduct('standard'));
    mocks.mockCreditServiceAddCredits.mockResolvedValue({ 
      success: true, 
      newBalance: TEST_PLANS.standard.credits 
    });
  });

  afterEach(() => {
    restoreEnvironment();
    jest.resetModules();
  });

  describe('customer.subscription.created', () => {
    it('should add credits and update user/subscription records', async () => {
      const mockEvent = createSubscriptionEvent('customer.subscription.created');
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_sub_created' }, 
        rawPayload
      );
      const response = await POST(req);

      await expectSuccessfulResponse(response, mockEvent.id);
      
      expect(mocks.mockUserFindFirst).toHaveBeenCalledWith({ 
        where: { stripeCustomerId: TEST_IDS.stripeCustomerId } 
      });
      expect(mocks.mockStripeProductsRetrieve).toHaveBeenCalledWith(TEST_IDS.productId);
      
      expect(mocks.mockCreditServiceAddCredits).toHaveBeenCalledWith(
        TEST_IDS.userId,
        TEST_PLANS.standard.credits,
        'subscription_created',
        `Credits for new ${TEST_PLANS.standard.name} subscription`,
        'subscription',
        TEST_IDS.subscriptionId,
        expect.objectContaining({
          planName: TEST_PLANS.standard.name,
          stripeSubscriptionId: TEST_IDS.subscriptionId,
          status: 'active'
        })
      );
      
      expect(mocks.mockUserUpdate).toHaveBeenCalledWith({
        where: { id: TEST_IDS.userId },
        data: { 
          stripeCustomerId: TEST_IDS.stripeCustomerId,
          subscriptionStatus: 'active', 
          subscriptionPlan: TEST_PLANS.standard.name 
        },
      });
      
      expect(mocks.mockSubscriptionUpsert).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: TEST_IDS.subscriptionId },
        create: expect.objectContaining({ 
          userId: TEST_IDS.userId, 
          planName: TEST_PLANS.standard.name, 
          status: 'active',
          monthlyCredits: TEST_PLANS.standard.credits,
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date)
        }),
        update: expect.objectContaining({ 
          planName: TEST_PLANS.standard.name, 
          status: 'active',
          monthlyCredits: TEST_PLANS.standard.credits,
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date)
        }),
      });
    });

    it('should return warning if user not found', async () => {
      mocks.mockUserFindFirst.mockResolvedValue(null);
      const mockEvent = createSubscriptionEvent('customer.subscription.created');
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_sub_no_user' }, 
        rawPayload
      );
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual(
        expect.objectContaining({ 
          warning: expect.stringContaining('User not found') 
        })
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('User not found for stripeCustomerId'), 
        expect.objectContaining({ subscriptionId: TEST_IDS.subscriptionId })
      );
      expect(mocks.mockCreditServiceAddCredits).not.toHaveBeenCalled();
      expect(mocks.mockUserUpdate).not.toHaveBeenCalled();
      expect(mocks.mockSubscriptionUpsert).not.toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('customer.subscription.updated', () => {
    it('should handle status change to active and add credits', async () => {
      const mockEvent = createSubscriptionEvent('customer.subscription.updated', {
        status: 'active',
      });
      // Add previous_attributes after creation since it's not part of Stripe.Subscription type
      (mockEvent.data.object as any).previous_attributes = { status: 'trialing' };
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_sub_updated' }, 
        rawPayload
      );
      const response = await POST(req);

      await expectSuccessfulResponse(response, mockEvent.id);
      
      expect(mocks.mockCreditServiceAddCredits).toHaveBeenCalledWith(
        TEST_IDS.userId,
        TEST_PLANS.standard.credits,
        'subscription_activated',
        `Credits for activated ${TEST_PLANS.standard.name} subscription`,
        'subscription',
        TEST_IDS.subscriptionId,
        expect.objectContaining({
          planName: TEST_PLANS.standard.name,
          stripeSubscriptionId: TEST_IDS.subscriptionId,
          status: 'active'
        })
      );
      
      expect(mocks.mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ 
          data: expect.objectContaining({ 
            stripeCustomerId: TEST_IDS.stripeCustomerId,
            subscriptionStatus: 'active', 
            subscriptionPlan: TEST_PLANS.standard.name 
          }) 
        })
      );
    });

    it('should handle plan change and grant new credits', async () => {
      const newProductId = 'prod_premium_plan';
      const mockEvent = createSubscriptionEvent('customer.subscription.updated', {
        items: {
          data: [{
            price: {
              product: newProductId,
              id: 'price_premium',
            },
          }],
        } as any,
      });
      // Add previous_attributes after creation since it's not part of Stripe.Subscription type
      (mockEvent.data.object as any).previous_attributes = { 
        items: { 
          data: [{ 
            price: { product: TEST_IDS.productId } 
          }] 
        } 
      };
      
      mocks.mockStripeProductsRetrieve.mockResolvedValue(createMockProduct('premium'));
      mocks.mockCreditServiceAddCredits.mockResolvedValue({ 
        success: true, 
        newBalance: TEST_PLANS.premium.credits 
      });
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_sub_plan_change' }, 
        rawPayload
      );
      const response = await POST(req);

      await expectSuccessfulResponse(response, mockEvent.id);
      
      expect(mocks.mockCreditServiceAddCredits).toHaveBeenCalledWith(
        TEST_IDS.userId,
        TEST_PLANS.premium.credits,
        'subscription_activated',
        `Credits for activated ${TEST_PLANS.premium.name} subscription`,
        'subscription',
        TEST_IDS.subscriptionId,
        expect.objectContaining({
          planName: TEST_PLANS.premium.name,
          stripeSubscriptionId: TEST_IDS.subscriptionId,
          status: 'active'
        })
      );
      
      expect(mocks.mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ 
          data: expect.objectContaining({ 
            stripeCustomerId: TEST_IDS.stripeCustomerId,
            subscriptionPlan: TEST_PLANS.premium.name,
            subscriptionStatus: 'active'
          }) 
        })
      );
    });

    it('should handle CreditService failure gracefully', async () => {
      const creditServiceError = new Error('CreditService.addCredits explosion');
      mocks.mockCreditServiceAddCredits.mockRejectedValue(creditServiceError);
      
      const mockEvent = createSubscriptionEvent('customer.subscription.updated');
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_sub_credit_fail' }, 
        rawPayload
      );
      const response = await POST(req);
      const responseBody = await response.json();
      
      expect(response.status).toBe(200);
      expect(responseBody).toEqual(
        expect.objectContaining({ 
          error: 'Failed to process customer.subscription.updated. View logs.',
          details: creditServiceError.message 
        })
      );
      expect(mocks.mockCreditServiceAddCredits).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error processing customer.subscription.updated for subscription'), 
        expect.any(String), 
        expect.any(String)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('customer.subscription.deleted', () => {
    it('should update user/subscription status without adding credits', async () => {
      const mockEvent = createSubscriptionEvent('customer.subscription.deleted', {
        status: 'canceled',
      });
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_sub_deleted' }, 
        rawPayload
      );
      const response = await POST(req);

      await expectSuccessfulResponse(response, mockEvent.id);
      
      expect(mocks.mockUserFindFirst).toHaveBeenCalledWith({ 
        where: { stripeCustomerId: TEST_IDS.stripeCustomerId } 
      });
      expect(mocks.mockCreditServiceAddCredits).not.toHaveBeenCalled();
      
      expect(mocks.mockUserUpdate).toHaveBeenCalledWith({
        where: { id: TEST_IDS.userId },
        data: { subscriptionStatus: 'canceled' },
      });
      
      expect(mocks.mockSubscriptionUpdateMany).toHaveBeenCalledWith({
        where: { 
          stripeSubscriptionId: TEST_IDS.subscriptionId, 
          userId: TEST_IDS.userId 
        },
        data: { status: 'canceled' },
      });
    });
  });
}); 