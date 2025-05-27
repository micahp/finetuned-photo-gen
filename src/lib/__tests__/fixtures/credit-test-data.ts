export const TEST_USER_ID = 'test-user-id';
export const INITIAL_BALANCE = 1000;

export const mockUser = {
  id: TEST_USER_ID,
  credits: INITIAL_BALANCE,
  email: 'test@example.com',
  name: 'Test User',
  emailVerified: null,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  subscriptionId: null,
  subscriptionStatus: null,
  stripeCustomerId: null,
  planId: 'free',
  usageNotifiedAt: null,
};

export const mockPlans = {
  free: {
    id: 'free',
    credits: 100,
    maxModels: 1,
  },
  pro: {
    id: 'pro',
    credits: 1000,
    maxModels: 5,
  },
  pro_analytics: {
    id: 'pro_analytics',
    credits: 1000,
    maxModels: 5,
  },
  free_tier: {
    id: 'free_tier',
    credits: 0,
    maxModels: 1,
  },
  no_model_plan: {
    id: 'no_model_plan',
    credits: 1000,
    maxModels: 0,
  },
  free_zero_credit: {
    id: 'free_zero_credit',
    credits: 0,
    maxModels: 1,
  },
};

export const transactionTypes = {
  spent: 'spent' as const,
  earned: 'earned' as const,
  purchased: 'purchased' as const,
  subscription_renewal: 'subscription_renewal' as const,
  admin_adjustment: 'admin_adjustment' as const,
};

export const relatedEntityTypes = {
  image_generation: 'image_generation' as const,
  subscription: 'subscription' as const,
};

export const mockTransactionData = {
  spend: {
    userId: TEST_USER_ID,
    amount: -50,
    type: transactionTypes.spent,
    description: 'Test spend transaction',
    relatedEntity: relatedEntityTypes.image_generation,
    relatedEntityId: 'image-gen-123',
  },
  earn: {
    userId: TEST_USER_ID,
    amount: 50,
    type: transactionTypes.earned,
    description: 'Test earned transaction',
  },
  purchase: {
    userId: TEST_USER_ID,
    amount: 100,
    type: transactionTypes.purchased,
    description: 'Purchased credits',
    relatedEntityType: relatedEntityTypes.subscription,
    relatedEntityId: 'sub-xyz',
  },
};

export const mockRecentTransactions = [
  {
    id: 'tx1',
    amount: -50,
    type: 'spent',
    description: 'Image Gen Q',
    createdAt: new Date(),
    balanceAfter: 750,
  },
  {
    id: 'tx2',
    amount: 200,
    type: 'purchased',
    description: 'Credit Pack',
    createdAt: new Date(),
    balanceAfter: 800,
  },
];

export const mockUsageTrends = [
  {
    date: new Date('2023-03-15T00:00:00.000Z'),
    credits_used: 30,
    images_generated: 3,
  },
  {
    date: new Date('2023-03-10T00:00:00.000Z'),
    credits_used: 20,
    images_generated: 2,
  },
];

export const errorMessages = {
  userNotFound: 'User not found',
  insufficientCredits: 'Insufficient credits',
  dbErrorUserUpdate: 'DB error during user update',
  dbErrorTransactionCreate: 'DB error during creditTransaction create',
  unexpectedError: 'Unexpected explosion in recordTransaction',
  failedToRecord: 'Failed to record transaction',
  failedToAdd: 'Failed to add credits (unexpected error)',
  failedToProcess: 'Failed to process credit transaction (unexpected error)',
}; 