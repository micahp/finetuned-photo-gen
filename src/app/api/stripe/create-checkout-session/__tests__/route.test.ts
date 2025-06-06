import { NextRequest } from 'next/server';
import { POST } from '../route';
import httpMocks from 'node-mocks-http';
import { auth } from '@/lib/next-auth';
import { stripe } from '@/lib/stripe';

jest.mock('@/lib/next-auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
  },
}));

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
const createMockRequest = (method: HttpMethod, body?: any, headers?: Record<string, string>) => {
  const mockReq = httpMocks.createRequest<NextRequest>({
    method,
    url: '/api/stripe/create-checkout-session',
    headers: { 'content-type': 'application/json', ...headers },
    ...(body !== undefined && { body }),
  });
  if (typeof body === 'string' && body === 'this is not json') {
    // Special case for testing invalid JSON body directly
  } else if (body !== undefined) {
    (mockReq as any).json = jest.fn().mockResolvedValue(body);
  } else {
    (mockReq as any).json = jest.fn().mockResolvedValue({});
  }
  return mockReq as unknown as NextRequest;
};

describe('/api/stripe/create-checkout-session', () => {
  const mockUserId = 'user_test_123';
  const mockUserEmail = 'test@example.com';
  const mockPriceId = 'price_test_456';
  const mockMode = 'payment';
  const mockQuantity = 1;

  beforeEach(() => {
    (auth as jest.Mock).mockReset();
    (stripe.checkout.sessions.create as jest.Mock).mockReset();
  });

  describe('POST', () => {
    it('should return 401 if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValueOnce(null);
      const req = createMockRequest('POST', { priceId: mockPriceId, mode: mockMode });
      const response = await POST(req);
      const responseBody = await response.json();
      expect(response.status).toBe(401);
      expect(responseBody.error).toBe('Authentication required');
    });

    it('should return 400 if request body is not valid JSON', async () => {
      (auth as jest.Mock).mockResolvedValueOnce({ user: { id: mockUserId, email: mockUserEmail } });
      const rawReq = httpMocks.createRequest<NextRequest>({
        method: 'POST',
        url: '/api/stripe/create-checkout-session',
        headers: { 'content-type': 'application/json' },
        body: 'this is not json', 
      });
      (rawReq as any).json = jest.fn().mockRejectedValueOnce(new SyntaxError('Unexpected token'));
      const response = await POST(rawReq as unknown as NextRequest);
      const responseBody = await response.json();
      expect(response.status).toBe(400);
      expect(responseBody.error).toBe('Invalid request body: Could not parse JSON.');
    });

    it('should return 400 if priceId is missing (Zod validation)', async () => {
      (auth as jest.Mock).mockResolvedValueOnce({ user: { id: mockUserId, email: mockUserEmail } });
      const req = createMockRequest('POST', { mode: mockMode });
      const response = await POST(req);
      const responseBody = await response.json();
      expect(response.status).toBe(400);
      expect(responseBody.error).toBe('Required');
    });

    it('should return 400 if mode is missing (Zod validation)', async () => {
      (auth as jest.Mock).mockResolvedValueOnce({ user: { id: mockUserId, email: mockUserEmail } });
      const req = createMockRequest('POST', { priceId: mockPriceId });
      const response = await POST(req);
      const responseBody = await response.json();
      expect(response.status).toBe(400);
      expect(responseBody.error).toBe('Mode is required (e.g., subscription, payment)');
    });

    it('should create a Stripe Checkout session and return 200 with sessionId and url', async () => {
      (auth as jest.Mock).mockResolvedValueOnce({ user: { id: mockUserId, email: mockUserEmail } });
      const mockStripeSession = { id: 'cs_test_789', url: 'https://checkout.stripe.com/pay/cs_test_789' };
      (stripe.checkout.sessions.create as jest.Mock).mockResolvedValueOnce(mockStripeSession);

      const req = createMockRequest('POST', { priceId: mockPriceId, mode: mockMode, quantity: mockQuantity });
      const response = await POST(req);
      const responseBody = await response.json();

      expect(response.status).toBe(200);
      expect(responseBody.sessionId).toBe(mockStripeSession.id);
      expect(responseBody.url).toBe(mockStripeSession.url);
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith({
        line_items: [
          {
            price: mockPriceId,
            quantity: mockQuantity,
          },
        ],
        mode: mockMode,
        success_url: `http://localhost:3000/dashboard/billing?session_id={CHECKOUT_SESSION_ID}&refresh=true`,
        cancel_url: `http://localhost:3000/dashboard/billing`,
        customer_email: mockUserEmail,
        metadata: {
          userId: mockUserId,
        }
      });
    });

    it('should return 500 if Stripe session creation fails', async () => {
      (auth as jest.Mock).mockResolvedValueOnce({ user: { id: mockUserId, email: mockUserEmail } });
      (stripe.checkout.sessions.create as jest.Mock).mockRejectedValueOnce(new Error('Stripe API error'));
      const req = createMockRequest('POST', { priceId: mockPriceId, mode: mockMode });
      const response = await POST(req);
      const responseBody = await response.json();
      expect(response.status).toBe(500);
      expect(responseBody.error).toBe('Failed to create Stripe Checkout session. An unexpected error occurred.');
    });
  });
}); 