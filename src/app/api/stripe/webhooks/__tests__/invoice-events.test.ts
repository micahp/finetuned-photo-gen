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
  createInvoiceEvent, 
  createMockUser, 
  createMockProduct, 
  createMockSubscription,
  TEST_IDS, 
  TEST_PLANS 
} from './fixtures/webhook-events.fixtures';

describe('Stripe Webhook - invoice.payment_succeeded', () => {
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
    mocks.mockUserFindFirst.mockResolvedValue(
      createMockUser({ subscriptions: [] })
    );
    mocks.mockUserUpdate.mockResolvedValue(createMockUser());
    mocks.mockSubscriptionUpsert.mockResolvedValue({ id: 'dbsub_invoice_event' });
    mocks.mockStripeSubscriptionsRetrieve.mockResolvedValue(
      createMockSubscription({
        items: {
          data: [{
            price: {
              product: createMockProduct('standard'),
              id: TEST_IDS.priceId,
            },
          }],
        },
      })
    );
    mocks.mockCreditServiceAddCredits.mockResolvedValue({ 
      success: true, 
      newBalance: TEST_PLANS.standard.credits 
    });
  });

  afterEach(() => {
    restoreEnvironment();
    jest.resetModules();
  });

  describe('Subscription Renewal', () => {
    it('should add credits and update records for subscription renewal', async () => {
      const mockEvent = createInvoiceEvent();
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_invoice_paid_sub' }, 
        rawPayload
      );
      const response = await POST(req);

      await expectSuccessfulResponse(response, mockEvent.id);
      
      expect(mocks.mockUserFindFirst).toHaveBeenCalledWith({ 
        where: { stripeCustomerId: TEST_IDS.stripeCustomerId }
      });
      expect(mocks.mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith(
        TEST_IDS.subscriptionId, 
        { expand: ['items.data.price.product'] }
      );
      expect(mocks.mockStripeProductsRetrieve).not.toHaveBeenCalled();
      
      expect(mocks.mockCreditServiceAddCredits).toHaveBeenCalledWith(
        TEST_IDS.userId,
        TEST_PLANS.standard.credits,
        'subscription_renewal',
        `Credits for ${TEST_PLANS.standard.name} renewal`,
        'subscription',
        TEST_IDS.subscriptionId,
        expect.objectContaining({
          planName: TEST_PLANS.standard.name,
          stripeSubscriptionId: TEST_IDS.subscriptionId,
          invoiceId: TEST_IDS.invoiceId
        }),
        expect.any(String) // Event ID
      );
      
      expect(mocks.mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ 
            subscriptionPlan: TEST_PLANS.standard.name, 
            subscriptionStatus: 'active' 
          }),
        })
      );
      
      expect(mocks.mockSubscriptionUpdateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: TEST_IDS.subscriptionId },
        data: {
          status: 'active',
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
          monthlyCredits: TEST_PLANS.standard.credits,
        },
      });
    });

    it('should NOT add credits if invoice amount_paid is 0', async () => {
      const mockEvent = createInvoiceEvent({
        amount_paid: 0, // Zero amount invoice (e.g., trial)
      });
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_invoice_zero' }, 
        rawPayload
      );
      const response = await POST(req);

      const responseBody = await response.json();
      expect(response.status).toBe(200);
      expect(responseBody).toEqual({
        received: true,
        message: 'Invoice not for renewal or $0, no credits processed.',
      });
      
      expect(mocks.mockCreditServiceAddCredits).not.toHaveBeenCalled();
      expect(mocks.mockUserUpdate).not.toHaveBeenCalled();
      expect(mocks.mockSubscriptionUpsert).not.toHaveBeenCalled();
    });

    it('should log warning if subscription ID is missing from invoice', async () => {
      const mockEvent = createInvoiceEvent();
      // Override subscription after creation since it's not in the Partial<Invoice> type
      (mockEvent.data.object as any).subscription = null;
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_invoice_no_sub' }, 
        rawPayload
      );
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({
        received: true,
        warning: 'No subscription ID on invoice, not a renewal.',
      });
      
      expect(mocks.mockCreditServiceAddCredits).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Invoice ${TEST_IDS.invoiceId} paid, but no subscription ID found`)
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('should return warning if user not found by stripeCustomerId', async () => {
      mocks.mockUserFindFirst.mockResolvedValue(null);
      const mockEvent = createInvoiceEvent();
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_invoice_no_user' }, 
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
        expect.stringContaining(`User not found for invoice ${TEST_IDS.invoiceId}`)
      );
      expect(mocks.mockCreditServiceAddCredits).not.toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle CreditService failure gracefully', async () => {
      const creditServiceError = new Error('CreditService invoice explosion');
      mocks.mockCreditServiceAddCredits.mockRejectedValue(creditServiceError);
      
      const mockEvent = createInvoiceEvent();
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_invoice_credit_fail' }, 
        rawPayload
      );
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ 
        received: true,
        error: 'Failed to process invoice. View logs.', 
        details: creditServiceError.message 
      });
      expect(mocks.mockCreditServiceAddCredits).toHaveBeenCalled();
      expect(mocks.mockUserUpdate).not.toHaveBeenCalled();
      expect(mocks.mockSubscriptionUpsert).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error processing invoice.payment_succeeded for invoice'), 
        expect.any(String), 
        expect.any(String)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });
}); 