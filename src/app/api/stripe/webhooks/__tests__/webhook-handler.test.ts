import { 
  createMockRequest, 
  createMockServices, 
  setupMocks, 
  resetMocks, 
  setupEnvironment,
  expectErrorResponse,
  expectSuccessfulResponse,
  MOCK_WEBHOOK_SECRET,
  type MockServices 
} from './utils/test-helpers.utils';

describe('Stripe Webhook Handler - Basic Functionality', () => {
  let POST: any;
  let mocks: MockServices;
  let restoreEnvironment: () => void;

  beforeEach(() => {
    mocks = createMockServices();
    setupMocks(mocks);
    restoreEnvironment = setupEnvironment();
    
    // Dynamically require the module under test after mocks are established
    POST = require('../route').POST;
    resetMocks(mocks);
  });

  afterEach(() => {
    restoreEnvironment();
    jest.resetModules();
  });

  describe('Request Validation', () => {
    const mockEventPayload = { type: 'test.event', data: { object: {} } };
    const rawPayload = JSON.stringify(mockEventPayload);

    it('should return 405 if req.method is not POST', async () => {
      const req = createMockRequest('GET', {});
      const response = await POST(req);
      
      await expectErrorResponse(response, 405, 'Method Not Allowed');
    });

    it('should return 400 if stripe-signature header is missing', async () => {
      const req = createMockRequest('POST', mockEventPayload, {}, rawPayload);
      const response = await POST(req);
      
      await expectErrorResponse(response, 400, 'Webhook signature verification failed');
    });

    it('should return 400 if signature verification fails', async () => {
      mocks.mockStripeConstructEvent.mockImplementation(() => {
        const error: any = new Error('Test signature verification error');
        error.type = 'StripeSignatureVerificationError';
        throw error;
      });

      const req = createMockRequest(
        'POST', 
        mockEventPayload, 
        { 'stripe-signature': 'sig_invalid' }, 
        rawPayload
      );
      const response = await POST(req);

      await expectErrorResponse(response, 400, 'Webhook signature verification failed');
      expect(mocks.mockStripeConstructEvent).toHaveBeenCalledWith(
        rawPayload,
        'sig_invalid',
        MOCK_WEBHOOK_SECRET
      );
    });

    it('should return 200 OK if signature is valid and event is processed', async () => {
      const mockConstructedEvent = { 
        id: 'evt_test_12345', 
        type: 'test.event.successful' 
      };
      mocks.mockStripeConstructEvent.mockReturnValue(mockConstructedEvent);

      const req = createMockRequest(
        'POST', 
        mockEventPayload, 
        { 'stripe-signature': 'sig_valid' }, 
        rawPayload
      );
      const response = await POST(req);

      await expectSuccessfulResponse(response, mockConstructedEvent.id);
      expect(mocks.mockStripeConstructEvent).toHaveBeenCalledWith(
        rawPayload,
        'sig_valid',
        MOCK_WEBHOOK_SECRET
      );
    });

    it('should return 500 if a non-Stripe error occurs during processing', async () => {
      mocks.mockStripeConstructEvent.mockImplementation(() => {
        throw new Error('Some unexpected internal server error');
      });

      const req = createMockRequest(
        'POST', 
        mockEventPayload, 
        { 'stripe-signature': 'sig_causes_internal_error' }, 
        rawPayload
      );
      const response = await POST(req);

      await expectErrorResponse(response, 500, 'Webhook handler failed');
    });
  });
}); 