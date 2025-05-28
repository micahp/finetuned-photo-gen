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
});

export const setupMocks = (mocks: MockServices) => {
  jest.resetModules();

  // Mock CreditService
  jest.doMock('@/lib/credit-service', () => ({
    CreditService: {
      addCredits: mocks.mockCreditServiceAddCredits,
    },
  }));

  // Mock Prisma
  jest.doMock('@/lib/db', () => ({
    prisma: {
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
      $transaction: jest.fn(async (callback) => callback({
        user: {
          update: mocks.mockUserUpdate,
          findUnique: mocks.mockUserFindUnique,
          findFirst: mocks.mockUserFindFirst,
        },
        subscription: {
          upsert: mocks.mockSubscriptionUpsert,
          updateMany: mocks.mockSubscriptionUpdateMany,
        },
      })),
    },
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
  Object.values(mocks).forEach(mock => mock.mockReset());
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