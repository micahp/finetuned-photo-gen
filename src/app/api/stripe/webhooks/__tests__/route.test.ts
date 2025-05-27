import { NextRequest } from 'next/server';
import { POST } from '../route';
import httpMocks from 'node-mocks-http';
import { stripe } from '../../../../../lib/stripe'; // Corrected path

// Mock the stripe library, specifically the webhooks.constructEvent method
jest.mock('../../../../../lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
}));

// Helper to create mock requests
// Define a more specific type for the method argument
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
  const MOCK_WEBHOOK_SECRET = 'whsec_test_secret';
  const originalStripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    // Reset mocks before each test
    (stripe.webhooks.constructEvent as jest.Mock).mockReset();
    // Set the environment variable for the tests
    process.env.STRIPE_WEBHOOK_SECRET = MOCK_WEBHOOK_SECRET;
  });

  afterEach(() => {
    // Restore original environment variable
    process.env.STRIPE_WEBHOOK_SECRET = originalStripeWebhookSecret;
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
      expect(response.status).toBe(400); // Expecting 400 due to missing signature
      expect(responseBody.error).toContain('Webhook signature verification failed');
    });

    it('should return 400 if signature verification fails (e.g., invalid signature)', async () => {
      (stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
        // Simulate Stripe throwing an error for invalid signature
        const error: any = new Error('Test signature verification error');
        error.type = 'StripeSignatureVerificationError'; // Important for the catch block in route.ts
        throw error;
      });

      const req = createMockRequest('POST', mockEventPayload, { 'stripe-signature': 'sig_invalid' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(400);
      expect(responseBody.error).toContain('Webhook signature verification failed: Test signature verification error');
      expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        rawPayload,
        'sig_invalid',
        MOCK_WEBHOOK_SECRET
      );
    });

    it('should return 200 OK and { received: true, eventId: ... } if signature is valid and event is processed (mocked)', async () => {
      const mockConstructedEvent = { id: 'evt_test_12345', type: 'test.event.successful' };
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockConstructedEvent);

      const req = createMockRequest('POST', mockEventPayload, { 'stripe-signature': 'sig_valid' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody).toEqual({ received: true, eventId: mockConstructedEvent.id });
      expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        rawPayload,
        'sig_valid',
        MOCK_WEBHOOK_SECRET
      );
      // Optionally, add console.log check if event type is logged in route.ts
      // console.log('Mock event type:', mockConstructedEvent.type);
    });

    it('should return 500 if a non-Stripe error occurs during processing', async () => {
      (stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
        throw new Error('Some unexpected internal server error');
      });

      const req = createMockRequest('POST', mockEventPayload, { 'stripe-signature': 'sig_causes_internal_error' }, rawPayload);
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(500);
      expect(responseBody).toEqual({ error: 'Webhook handler failed. View logs.' });
    });
  });
}); 