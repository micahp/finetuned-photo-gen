import { NextRequest } from 'next/server';
import httpMocks from 'node-mocks-http';

// Helper to create mock requests
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export const createMockRequest = (
  method: HttpMethod,
  body: any,
  headers?: Record<string, string>,
  rawBody?: string
) => {
  const mockReq = httpMocks.createRequest<NextRequest>({
    method,
    url: '/api/stripe/webhooks',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body,
    _readableStream: rawBody ? Buffer.from(rawBody) : undefined,
  });
  
  // Mock req.text() for raw body retrieval
  mockReq.text = jest.fn().mockResolvedValue(rawBody || JSON.stringify(body));
  return mockReq as unknown as NextRequest;
};

export const MOCK_WEBHOOK_SECRET = 'whsec_test_secret';

export interface MockServices {
  mockUserUpdate: jest.Mock;
  mockUserFindUnique: jest.Mock;
  mockUserFindFirst: jest.Mock;
  mockSubscriptionCreate: jest.Mock;
  mockSubscriptionUpdate: jest.Mock;
  mockSubscriptionUpsert: jest.Mock;
  mockSubscriptionUpdateMany: jest.Mock;
  mockStripeConstructEvent: jest.Mock;
  mockStripeSubscriptionsRetrieve: jest.Mock;
  mockStripeProductsRetrieve: jest.Mock;
  mockCreditServiceAddCredits: jest.Mock;
  mockProcessedStripeEventCreate: jest.Mock;
}

export const createMockServices = (): MockServices => ({
  mockUserUpdate: jest.fn(),
  mockUserFindUnique: jest.fn(),
  mockUserFindFirst: jest.fn(),
  mockSubscriptionCreate: jest.fn(),
  mockSubscriptionUpdate: jest.fn(),
  mockSubscriptionUpsert: jest.fn(),
  mockSubscriptionUpdateMany: jest.fn(),
  mockStripeConstructEvent: jest.fn(),
  mockStripeSubscriptionsRetrieve: jest.fn(),
  mockStripeProductsRetrieve: jest.fn(),
  mockCreditServiceAddCredits: jest.fn(),
  mockProcessedStripeEventCreate: jest.fn(),
});

export const setupMocks = (mocks: MockServices) => {
  jest.resetModules();

  // Mock CreditService
  jest.doMock('@/lib/credit-service', () => ({
    CreditService: {
      addCredits: mocks.mockCreditServiceAddCredits,
    },
  }));

  // This is the main mock for the prisma client.
  // It will be used for both top-level queries and for the transaction client (`tx`).
  const mockPrismaClient = {
    user: {
      update: mocks.mockUserUpdate,
      findUnique: mocks.mockUserFindUnique,
      findFirst: mocks.mockUserFindFirst,
    },
    subscription: {
      create: mocks.mockSubscriptionCreate,
      update: mocks.mockSubscriptionUpdate,
      upsert: mocks.mockSubscriptionUpsert,
      updateMany: mocks.mockSubscriptionUpdateMany,
    },
    processedStripeEvent: {
      create: mocks.mockProcessedStripeEventCreate,
      findUnique: jest.fn().mockResolvedValue(null), // Default to not finding an event
    },
    $transaction: jest.fn(), // Defined late to allow self-reference
  };

  // The transaction callback will receive the same mock client, ensuring `tx` has the same shape.
  mockPrismaClient.$transaction.mockImplementation(async (callback) => callback(mockPrismaClient));

  // Mock Prisma
  jest.doMock('@/lib/db', () => ({
    prisma: mockPrismaClient,
  }));

  // Mock Stripe - using relative path as in the route file
  jest.doMock('../../../../../../lib/stripe', () => ({
    stripe: {
      webhooks: {
        constructEvent: mocks.mockStripeConstructEvent,
      },
      subscriptions: {
        retrieve: mocks.mockStripeSubscriptionsRetrieve,
      },
      products: {
        retrieve: mocks.mockStripeProductsRetrieve,
      },
      errors: {
        StripeSignatureVerificationError: jest.fn(),
      },
    },
  }));
};

export const resetMocks = (mocks: MockServices) => {
  Object.values(mocks).forEach((mock: jest.Mock) => mock.mockReset());
};

export const setupEnvironment = () => {
  const originalStripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = MOCK_WEBHOOK_SECRET;
  
  const restoreEnvironment = () => {
    process.env.STRIPE_WEBHOOK_SECRET = originalStripeWebhookSecret;
  };
  
  return restoreEnvironment;
};

export const expectSuccessfulResponse = (response: Response, eventId: string) => {
  expect(response.status).toBe(200);
  return expect(response.json()).resolves.toEqual({
    received: true,
    eventId,
  });
};

export const expectErrorResponse = (response: Response, status: number, errorMessage?: string) => {
  expect(response.status).toBe(status);
  if (errorMessage) {
    return expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: expect.stringContaining(errorMessage) })
    );
  }
  return response.json();
}; 