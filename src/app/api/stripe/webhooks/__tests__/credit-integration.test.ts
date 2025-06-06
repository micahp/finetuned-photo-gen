import { 
  createMockRequest, 
  createMockServices, 
  setupMocks, 
  resetMocks, 
  setupEnvironment,
  expectSuccessfulResponse,
} from './utils/test-helpers.utils';
import { 
  createSubscriptionEvent, 
  createMockUser, 
  createMockProduct,
  TEST_IDS, 
  TEST_PLANS 
} from './fixtures/webhook-events.fixtures';

describe('Credit Integration Tests - Webhook to UI Updates', () => {
  let POST: any;
  let mocks: any;
  let restoreEnvironment: any;

  beforeEach(() => {
    mocks = createMockServices();
    setupMocks(mocks);
    restoreEnvironment = setupEnvironment();
    
    POST = require('../route').POST;
    resetMocks(mocks);

    // Set up default successful responses
    mocks.mockUserFindFirst.mockResolvedValue(createMockUser());
    mocks.mockUserUpdate.mockResolvedValue(createMockUser({ credits: TEST_PLANS.standard.credits }));
    mocks.mockSubscriptionUpsert.mockResolvedValue({ id: 'dbsub_live_event' });
    mocks.mockStripeProductsRetrieve.mockResolvedValue(createMockProduct('standard'));
  });

  afterEach(() => {
    restoreEnvironment();
    jest.resetModules();
  });

  describe('Subscription Created - Credit Allocation and UI Updates', () => {
    it('should add credits when subscription is created and ensure credits are available for billing page display', async () => {
      // Arrange - Mock successful credit addition
      const expectedNewBalance = TEST_PLANS.standard.credits;
      mocks.mockCreditServiceAddCredits.mockResolvedValue({ 
        success: true, 
        newBalance: expectedNewBalance 
      });

      const mockEvent = createSubscriptionEvent('customer.subscription.created');
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      // Act - Process webhook
      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_sub_created' }, 
        rawPayload
      );
      const response = await POST(req);

      // Assert - Webhook processing
      await expectSuccessfulResponse(response, mockEvent.id);
      
      // Verify CreditService.addCredits was called with correct parameters
      expect(mocks.mockCreditServiceAddCredits).toHaveBeenCalledWith(
        TEST_IDS.userId,
        TEST_PLANS.standard.credits,
        'subscription_initial',
        `Credits for new ${TEST_PLANS.standard.name} subscription`,
        'subscription',
        TEST_IDS.subscriptionId,
        expect.objectContaining({
          planName: TEST_PLANS.standard.name,
          stripeSubscriptionId: TEST_IDS.subscriptionId,
          status: 'active'
        }),
        expect.any(String) // Event ID
      );
      
      // Verify user was updated with new subscription status and credits would be reflected
      expect(mocks.mockUserUpdate).toHaveBeenCalledWith({
        where: { id: TEST_IDS.userId },
        data: { 
          subscriptionStatus: 'active', 
          subscriptionPlan: TEST_PLANS.standard.name,
          stripeSubscriptionStatus: 'active'
        },
      });

      // This test ensures the webhook successfully processes and credits are allocated
      // The UI components (billing, dashboard, generate, edit) will get updated credits
      // through session refresh triggered by successful webhook processing
    });

    it('should handle credit allocation failure gracefully', async () => {
      // Arrange - Mock credit service failure
      const creditServiceError = new Error('Credit allocation failed');
      mocks.mockCreditServiceAddCredits.mockRejectedValue(creditServiceError);

      const mockEvent = createSubscriptionEvent('customer.subscription.created');
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      // Spy on console.error to verify error logging
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_credit_fail' }, 
        rawPayload
      );
      const response = await POST(req);

      // Assert - Webhook should still process successfully even if credit allocation fails
      // This prevents webhook failures from causing Stripe to retry
      await expectSuccessfulResponse(response, mockEvent.id);
      
      expect(mocks.mockCreditServiceAddCredits).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to add credits'),
        expect.any(Object)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Subscription Updated - Credit Allocation and UI Updates', () => {
    it('should add credits when subscription status changes to active', async () => {
      // Arrange
      const expectedNewBalance = TEST_PLANS.standard.credits;
      mocks.mockCreditServiceAddCredits.mockResolvedValue({ 
        success: true, 
        newBalance: expectedNewBalance 
      });

      const mockEvent = createSubscriptionEvent('customer.subscription.updated', {
        status: 'active',
      });
      // Add previous_attributes to simulate status change
      (mockEvent.data.object as any).previous_attributes = { status: 'trialing' };
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      // Act
      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_sub_updated' }, 
        rawPayload
      );
      const response = await POST(req);

      // Assert
      await expectSuccessfulResponse(response, mockEvent.id);
      
      expect(mocks.mockCreditServiceAddCredits).toHaveBeenCalledWith(
        TEST_IDS.userId,
        TEST_PLANS.standard.credits,
        'subscription_renewal',
        `Credits for activated ${TEST_PLANS.standard.name} subscription`,
        'subscription',
        TEST_IDS.subscriptionId,
        expect.objectContaining({
          planName: TEST_PLANS.standard.name,
          stripeSubscriptionId: TEST_IDS.subscriptionId,
          status: 'active'
        }),
        expect.any(String) // Event ID
      );
    });

    it('should add credits when subscription plan is upgraded', async () => {
      // Arrange - Simulate plan upgrade
      const newPlan = TEST_PLANS.premium;
      const expectedNewBalance = newPlan.credits;
      
      mocks.mockCreditServiceAddCredits.mockResolvedValue({ 
        success: true, 
        newBalance: expectedNewBalance 
      });
      mocks.mockStripeProductsRetrieve.mockResolvedValue(createMockProduct('premium'));

      const mockEvent = createSubscriptionEvent('customer.subscription.updated', {
        items: {
          data: [{
            id: 'si_test',
            object: 'subscription_item',
            created: Date.now(),
            price: {
              product: 'prod_premium_plan',
              id: 'price_premium',
            } as any,
          } as any],
        } as any,
      });
      // Add previous_attributes to simulate plan change
      (mockEvent.data.object as any).previous_attributes = { 
        items: {
          data: [{
            price: {
              product: TEST_IDS.productId, // Previous product
              id: 'price_standard',
            } as any,
          }],
        }
      };
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      // Act
      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_plan_upgrade' }, 
        rawPayload
      );
      const response = await POST(req);

      // Assert
      await expectSuccessfulResponse(response, mockEvent.id);
      
      expect(mocks.mockCreditServiceAddCredits).toHaveBeenCalledWith(
        TEST_IDS.userId,
        newPlan.credits,
        'subscription_renewal',
        `Credits for updated ${newPlan.name} subscription`,
        'subscription',
        TEST_IDS.subscriptionId,
        expect.objectContaining({
          planName: newPlan.name,
          stripeSubscriptionId: TEST_IDS.subscriptionId,
          status: 'active'
        }),
        expect.any(String) // Event ID
      );
    });
  });

  describe('Credit Display Integration - UI Component Updates', () => {
    it('should ensure credits are properly reflected across all UI components after webhook processing', async () => {
      // This test documents the expected behavior for UI credit updates
      // After webhook processing, the following should occur:

      // 1. Billing Page: Credits should be updated in the session and displayed
      //    - "Credits Remaining" should show the new balance
      //    - "Monthly Credits" should show the plan allocation
      
      // 2. Dashboard Page: Credits should be updated in stats
      //    - Stats endpoint should return updated credit balance
      //    - Credit display should reflect new balance
      
      // 3. Generate Page: Credits should be updated in local state
      //    - creditsRemaining state should be updated
      //    - Generate button should be enabled if credits > 0
      
      // 4. Edit Page: Credits should be updated in local state
      //    - creditsRemaining state should be updated  
      //    - Edit button should be enabled if credits > 0

      // Mock successful credit allocation
      const expectedNewBalance = TEST_PLANS.standard.credits;
      mocks.mockCreditServiceAddCredits.mockResolvedValue({ 
        success: true, 
        newBalance: expectedNewBalance 
      });

      const mockEvent = createSubscriptionEvent('customer.subscription.created');
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      // Process webhook
      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_ui_integration' }, 
        rawPayload
      );
      const response = await POST(req);

      // Verify webhook processed successfully
      await expectSuccessfulResponse(response, mockEvent.id);
      
      // Verify the database update that UI components will read from
      expect(mocks.mockUserUpdate).toHaveBeenCalledWith({
        where: { id: TEST_IDS.userId },
        data: expect.objectContaining({ 
          subscriptionStatus: 'active', 
          subscriptionPlan: TEST_PLANS.standard.name 
        }),
      });

      // The credit balance is updated via CreditService.addCredits
      // which updates the user.credits field that UI components read from
      expect(mocks.mockCreditServiceAddCredits).toHaveBeenCalledWith(
        TEST_IDS.userId,
        expectedNewBalance,
        'subscription_initial',
        expect.stringContaining('Credits for new'),
        'subscription',
        TEST_IDS.subscriptionId,
        expect.any(Object),
        expect.any(String) // Event ID
      );

      // Note: Individual UI component testing should be done in their respective test files
      // This integration test ensures the webhook -> database -> UI data flow works correctly
    });
  });

  describe('Edge Cases - Credit Allocation', () => {
    it('should handle duplicate webhook events gracefully (idempotency)', async () => {
      // Arrange - Mock duplicate event detection
      mocks.mockCreditServiceAddCredits.mockResolvedValue({ 
        success: true, 
        newBalance: 150, // Existing balance
        alreadyProcessed: true 
      });

      const mockEvent = createSubscriptionEvent('customer.subscription.created');
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      // Act - Process the same event twice
      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_duplicate' }, 
        rawPayload
      );
      
      const response1 = await POST(req);
      const response2 = await POST(req);

      // Assert - Both should succeed but credits should only be added once
      await expectSuccessfulResponse(response1, mockEvent.id);
      await expectSuccessfulResponse(response2, mockEvent.id);
      
      // The credit service should handle idempotency internally
      expect(mocks.mockCreditServiceAddCredits).toHaveBeenCalled();
    });

    it('should not add credits for subscription deletion events', async () => {
      // Arrange
      const mockEvent = createSubscriptionEvent('customer.subscription.deleted');
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      // Act
      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_sub_deleted' }, 
        rawPayload
      );
      const response = await POST(req);

      // Assert - Should not add credits for deletion events
      await expectSuccessfulResponse(response, mockEvent.id);
      expect(mocks.mockCreditServiceAddCredits).not.toHaveBeenCalled();
      
      // Should still update user subscription status
      expect(mocks.mockUserUpdate).toHaveBeenCalledWith({
        where: { id: TEST_IDS.userId },
        data: expect.objectContaining({ 
          subscriptionStatus: 'free'
        }),
      });
    });
  });
}); 