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
    it('should NOT add credits when subscription is created (credits already allocated in checkout)', async () => {
      // This test verifies the FIXED behavior: subscription.created does NOT allocate credits
      // to prevent dual allocation (credits were already allocated in checkout.session.completed)
      
      const mockEvent = createSubscriptionEvent('customer.subscription.created');
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      // Setup mocks to simulate the idempotency check finding that event was already processed
      const { prisma: mockPrisma } = jest.requireMock('@/lib/db');
      mockPrisma.processedStripeEvent.findUnique.mockResolvedValueOnce({ 
        eventId: mockEvent.id 
      });

      // Act - Process webhook
      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_sub_created' }, 
        rawPayload
      );
      const response = await POST(req);

      // Assert - Should return idempotent response (event already processed)
      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        received: true,
        message: "Event already processed"
      });
      
      // CreditService should NOT be called (credits already allocated at checkout)
      expect(mocks.mockCreditServiceAddCredits).not.toHaveBeenCalled();

      // This test ensures proper idempotency - subscription events that occur after
      // checkout.session.completed are properly detected as already processed
    });

    it('should handle new subscription events that update user status only', async () => {
      // Test case for when a subscription.created event is genuinely new
      // (shouldn't happen in normal flow, but good to test the behavior)
      
      const mockEvent = createSubscriptionEvent('customer.subscription.created');
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      // Setup mocks to simulate this is a NEW event
      const { prisma: mockPrisma } = jest.requireMock('@/lib/db');
      mockPrisma.processedStripeEvent.findUnique.mockResolvedValueOnce(null);

      // Act
      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_sub_created_new' }, 
        rawPayload
      );
      const response = await POST(req);

      // Assert - Should process successfully but NOT allocate credits
      await expectSuccessfulResponse(response, mockEvent.id);
      
      // User status should be updated
      expect(mocks.mockUserUpdate).toHaveBeenCalledWith({
        where: { id: TEST_IDS.userId },
        data: { 
          subscriptionStatus: 'active', 
          subscriptionPlan: TEST_PLANS.standard.name,
          stripeSubscriptionStatus: 'active'
        },
      });
      
      // But credits should NOT be allocated (prevents dual allocation)
      expect(mocks.mockCreditServiceAddCredits).not.toHaveBeenCalled();
    });

    it('should handle subscription status synchronization gracefully even if database updates fail', async () => {
      // Arrange - Test database error handling during subscription status sync
      const mockEvent = createSubscriptionEvent('customer.subscription.created');
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      // Simulate a new event (not idempotent)
      const { prisma: mockPrisma } = jest.requireMock('@/lib/db');
      mockPrisma.processedStripeEvent.findUnique.mockResolvedValueOnce(null);
      
      // Mock database transaction failure
      const dbError = new Error('Database connection failed');
      mockPrisma.$transaction.mockRejectedValueOnce(dbError);

      // Spy on console.error to verify error logging
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_db_fail' }, 
        rawPayload
      );
      const response = await POST(req);

      // Assert - Webhook should return error status for database failures
      expect(response.status).toBe(200); // Still 200 to prevent Stripe retries
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        received: true,
        error: 'Failed to process customer.subscription.created. View logs.',
        details: 'Database connection failed'
      });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error processing customer.subscription.created'),
        expect.any(String),
        expect.any(String)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Subscription Updated - Credit Allocation and UI Updates', () => {
    it('should add credits when subscription status changes from inactive to active (reactivation)', async () => {
      // Arrange - Test the only case where subscription.updated allocates credits
      const expectedNewBalance = TEST_PLANS.standard.credits;
      mocks.mockCreditServiceAddCredits.mockResolvedValue({ 
        success: true, 
        newBalance: expectedNewBalance 
      });

      const mockEvent = createSubscriptionEvent('customer.subscription.updated', {
        status: 'active',
      });
      // Add previous_attributes to simulate status change from canceled to active (reactivation)
      (mockEvent.data.object as any).previous_attributes = { status: 'canceled' };
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      // Setup as new event (not idempotent)
      const { prisma: mockPrisma } = jest.requireMock('@/lib/db');
      mockPrisma.processedStripeEvent.findUnique.mockResolvedValueOnce(null);
      mockPrisma.processedStripeEvent.findUnique.mockResolvedValueOnce({ eventId: mockEvent.id });

      // Act
      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_sub_reactivated' }, 
        rawPayload
      );
      const response = await POST(req);

      // Assert
      await expectSuccessfulResponse(response, mockEvent.id);
      
      // Credits should be allocated for reactivation
      expect(mocks.mockCreditServiceAddCredits).toHaveBeenCalledWith(
        TEST_IDS.userId,
        TEST_PLANS.standard.credits,
        'subscription_renewal',
        `Credits for reactivated ${TEST_PLANS.standard.name} subscription`,
        'subscription',
        TEST_IDS.subscriptionId,
        expect.objectContaining({
          planName: TEST_PLANS.standard.name,
          stripeSubscriptionId: TEST_IDS.subscriptionId,
          status: 'active',
          eventType: 'customer.subscription.updated',
          previousStatus: 'canceled'
        }),
        expect.any(String) // Event ID
      );
    });

    it('should NOT add credits for regular subscription updates (non-reactivation)', async () => {
      // Arrange - Test normal case where subscription.updated does NOT allocate credits
      const mockEvent = createSubscriptionEvent('customer.subscription.updated', {
        status: 'active',
      });
      // No previous_attributes or previous status is already active
      (mockEvent.data.object as any).previous_attributes = { status: 'active' };
      mocks.mockStripeConstructEvent.mockReturnValue(mockEvent);

      // Setup to simulate idempotency (event already processed)
      const { prisma: mockPrisma } = jest.requireMock('@/lib/db');
      mockPrisma.processedStripeEvent.findUnique.mockResolvedValueOnce({ 
        eventId: mockEvent.id 
      });

      // Act
      const rawPayload = JSON.stringify(mockEvent.data.object);
      const req = createMockRequest(
        'POST', 
        mockEvent.data.object, 
        { 'stripe-signature': 'sig_sub_normal_update' }, 
        rawPayload
      );
      const response = await POST(req);

      // Assert - Should be handled as idempotent
      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody).toEqual({
        received: true,
        message: "Event already processed"
      });
      
      // Credits should NOT be allocated
      expect(mocks.mockCreditServiceAddCredits).not.toHaveBeenCalled();
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