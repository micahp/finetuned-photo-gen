import { POST } from './route'; // Adjust path as necessary
import { NextRequest } from 'next/server';

// Mock @/lib/next-auth explicitly for the auth function
jest.mock('@/lib/next-auth', () => ({
  auth: jest.fn(), // This is the function we want to mock
}));

// Mock @/lib/db for the prisma client (named export)
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock @/lib/stripe
jest.mock('@/lib/stripe', () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: jest.fn(),
      },
    },
  },
}));

// Import the mocked auth function
import { auth } from '@/lib/next-auth';

describe('POST /api/stripe/customer-portal', () => {
  beforeEach(() => {
    // Reset mocks before each test
    (auth as jest.Mock).mockReset();
    // Example of resetting a nested mock for prisma, adjust if findUnique is directly on prisma
    // This assumes prisma.user.findUnique structure. If findUnique is directly on prisma, mock jest.mocked(prisma.findUnique)
    const { prisma } = require('@/lib/db');
    jest.mocked(prisma.user.findUnique).mockReset();

    // Reset stripe mock if needed
    // const { stripe } = require('@/lib/stripe');
    // jest.mocked(stripe.billingPortal.sessions.create).mockReset();
  });

  it('should return 401 if user is not authenticated', async () => {
    // Arrange
    (auth as jest.Mock).mockResolvedValue(null); // Simulate no session

    const request = new NextRequest('http://localhost/api/stripe/customer-portal', {
      method: 'POST',
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  // --- Test: User authenticated but no Stripe Customer ID ---
  it('should return 400 if authenticated user has no stripeCustomerId', async () => {
    // Arrange
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }, // Simulate authenticated user
    });

    const { prisma } = require('@/lib/db');
    jest.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'user-123',
      email: 'test@example.com',
      stripeCustomerId: null, // User has no Stripe customer ID
      // ... other user properties
    });

    const request = new NextRequest('http://localhost/api/stripe/customer-portal', {
      method: 'POST',
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Stripe customer ID not found.');
  });

  // --- Test: Successful creation of Stripe Customer Portal session ---
  it('should return 200 and a portal session URL for an authenticated user with a stripeCustomerId', async () => {
    // Arrange
    const mockStripeCustomerId = 'cus_xxxxxxxxxxxxxx';
    const mockPortalSessionUrl = 'https://billing.stripe.com/session/test_session_url';
    const returnUrl = 'http://localhost:3000/dashboard/settings/billing'; // Example return URL

    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' },
    });

    const { prisma } = require('@/lib/db');
    jest.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'user-123',
      email: 'test@example.com',
      stripeCustomerId: mockStripeCustomerId,
      // ... other user properties
    });

    const { stripe } = require('@/lib/stripe');
    jest.mocked(stripe.billingPortal.sessions.create).mockResolvedValueOnce({
      id: 'pts_xxxxxxxxxxxxxx',
      url: mockPortalSessionUrl,
      // ... other portal session properties
    });

    // Mock req.headers.get to simulate how origin/host might be derived for returnUrl if not hardcoded
    // Or, more simply, ensure your actual implementation defines how returnUrl is formed.
    // For this test, we can assume the API route will construct/use a returnUrl.

    const request = new NextRequest('http://localhost/api/stripe/customer-portal', {
      method: 'POST',
      // If your API expects a body for returnUrl or similar, add it here.
      // For now, assuming it's derived or configured server-side.
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.url).toBe(mockPortalSessionUrl);

    // Verify Stripe SDK was called correctly
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: mockStripeCustomerId,
      return_url: expect.any(String), // Or be more specific if your API generates a predictable URL
    });
  });

  // Add more tests here for other scenarios (e.g., user authenticated but no stripeCustomerId, Stripe API errors, success case)
}); 