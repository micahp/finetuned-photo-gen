import { NextRequest } from 'next/server';
import httpMocks from 'node-mocks-http';

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
  const mockStripeConstructEvent = jest.fn();
  const MOCK_WEBHOOK_SECRET = 'whsec_test_secret';
  const originalStripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.resetModules(); // Crucial for jest.doMock to work correctly on subsequent test runs

    // Set up mocks *before* requiring the module under test
    jest.doMock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => ({
        user: {
          update: mockUserUpdate,
        },
      })),
    }));
    jest.doMock('../../../../../lib/stripe', () => ({
      stripe: {
        webhooks: {
          constructEvent: mockStripeConstructEvent,
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
    mockStripeConstructEvent.mockReset();
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
            mode: 'subscription',
            customer: stripeCustomerId,
            metadata: { userId },
          },
        },
      };
      mockStripeConstructEvent.mockReturnValue(mockSessionEvent);
      mockUserUpdate.mockResolvedValue({ id: userId, credits: 0 });

      const rawPayload = JSON.stringify(mockSessionEvent.data.object);
      const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_valid_checkout' }, rawPayload);
      
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, eventId: mockSessionEvent.id });
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          stripeCustomerId: stripeCustomerId,
          subscriptionStatus: 'active',
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
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          credits: { increment: creditsToPurchase },
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
            mode: 'payment',
            customer: stripeCustomerId,
            metadata: {}, // Missing userId
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
      expect(responseBody).toEqual({ received: true, error: 'User ID missing in metadata' });
      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '🔴 Error: userId not found in session metadata. Cannot process checkout.session.completed.',
        { sessionId: sessionId }
      );
      consoleErrorSpy.mockRestore();
    });

    it('should return 200 and log error if Prisma update fails', async () => {
      const mockSessionEvent = {
        id: 'evt_test_checkout_db_fail',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            mode: 'subscription',
            customer: stripeCustomerId,
            metadata: { userId },
          },
        },
      };
      mockStripeConstructEvent.mockReturnValue(mockSessionEvent);
      mockUserUpdate.mockRejectedValue(new Error('DB update failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const rawPayload = JSON.stringify(mockSessionEvent.data.object);
      const req = createMockRequest('POST', mockSessionEvent.data.object, { 'stripe-signature': 'sig_valid_checkout' }, rawPayload);

      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200); // Per plan, acknowledge with 200 even on DB error
      expect(responseBody).toEqual({ received: true, error: 'Database update failed' });
      expect(mockUserUpdate).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `🔴 Database error processing checkout.session.completed for user ${userId}:`,
        'DB update failed',
        { sessionId: sessionId }
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
            metadata: { userId, credits_purchased: 'not-a-number' }, // Invalid value
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
        '🔴 Error: Invalid credits_purchased value in session metadata.',
        { sessionId: sessionId, metadataValue: 'not-a-number' }
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
  });
}); 