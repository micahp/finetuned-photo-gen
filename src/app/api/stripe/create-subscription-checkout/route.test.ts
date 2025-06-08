import { POST } from './route';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/next-auth';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';

// Mock necessary modules
jest.mock('@/lib/next-auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
  },
}));

// Helper to create a mock NextRequest
const createMockRequest = (body: any, headers?: HeadersInit) => {
  return new NextRequest('http://localhost/api/stripe/create-subscription-checkout', {
    method: 'POST',
    headers: new Headers(headers),
    body: JSON.stringify(body),
  });
};

describe('POST /api/stripe/create-subscription-checkout', () => {
  const mockPriceId = 'price_1RTGE7Q8DfMDErUlV3adHlLg'; // Creator Plan Price ID
  const mockReturnUrl = 'http://localhost:3000/dashboard/billing';
  const mockUserId = 'user-123';
  const mockUserEmail = 'test@example.com';
  const mockStripeSessionUrl = 'https://checkout.stripe.com/mock_session_url';

  beforeEach(() => {
    // Reset all mocks before each test
    (auth as jest.Mock).mockReset();
    (prisma.user.findUnique as jest.Mock).mockReset();
    (stripe.checkout.sessions.create as jest.Mock).mockReset();
  });

  it('should return 401 Unauthorized if the user is not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null); // Simulate no session

    const request = createMockRequest({ priceId: mockPriceId, returnUrl: mockReturnUrl });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Unauthorized');
  });

  it('should return 400 Bad Request if priceId is missing', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: mockUserId, email: mockUserEmail } });

    const request = createMockRequest({ returnUrl: mockReturnUrl }); // Missing priceId
    const response = await POST(request);

    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Price ID and Return URL are required.');
  });

  it('should return 400 Bad Request if returnUrl is missing', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: mockUserId, email: mockUserEmail } });

    const request = createMockRequest({ priceId: mockPriceId }); // Missing returnUrl
    const response = await POST(request);

    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Price ID and Return URL are required.');
  });

  it('should return 500 if user is not found in database', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: mockUserId, email: mockUserEmail } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null); // User not found

    const request = createMockRequest({ priceId: mockPriceId, returnUrl: mockReturnUrl });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Could not find user.');
  });
  
  it('should create a Stripe Checkout session and return its URL for an authenticated user with stripeCustomerId', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: mockUserId, email: mockUserEmail } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: mockUserId,
      email: mockUserEmail,
      stripeCustomerId: 'cus_existing_customer_id',
    });
    (stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({
      url: mockStripeSessionUrl,
    });

    const request = createMockRequest({ priceId: mockPriceId, returnUrl: mockReturnUrl });
    const response = await POST(request);
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody.url).toBe(mockStripeSessionUrl);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_existing_customer_id',
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: mockPriceId, quantity: 1 }],
      success_url: `${mockReturnUrl}?session_id={CHECKOUT_SESSION_ID}&refresh=true`,
      cancel_url: `${mockReturnUrl}?canceled=true`,
      metadata: { userId: mockUserId },
    });
  });

  it('should create a Stripe Checkout session with customer_email if user has no stripeCustomerId', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: mockUserId, email: mockUserEmail } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: mockUserId,
      email: mockUserEmail,
      stripeCustomerId: null, // No Stripe customer ID
    });
    (stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({
      url: mockStripeSessionUrl,
    });

    const request = createMockRequest({ priceId: mockPriceId, returnUrl: mockReturnUrl });
    const response = await POST(request);
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody.url).toBe(mockStripeSessionUrl);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith({
      customer_email: mockUserEmail,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: mockPriceId, quantity: 1 }],
      success_url: `${mockReturnUrl}?session_id={CHECKOUT_SESSION_ID}&refresh=true`,
      cancel_url: `${mockReturnUrl}?canceled=true`,
      metadata: { userId: mockUserId },
    });
  });

  it('should return 500 if Stripe checkout session creation fails', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: mockUserId, email: mockUserEmail } });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: mockUserId,
      email: mockUserEmail,
      stripeCustomerId: 'cus_existing_customer_id',
    });
    (stripe.checkout.sessions.create as jest.Mock).mockRejectedValue(new Error('Stripe API error'));

    const request = createMockRequest({ priceId: mockPriceId, returnUrl: mockReturnUrl });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Failed to create Stripe Checkout session.');
    expect(responseBody.details).toBe('Stripe API error');
  });
}); 