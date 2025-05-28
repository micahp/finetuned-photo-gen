import { CreditService } from '../../credit-service';
import { TEST_USER_ID, INITIAL_BALANCE, mockUser } from '../fixtures/credit-test-data.fixtures';

// Access prismaMock from the global scope
const prismaMock = (global as any).prismaMock;

// Mock getCurrentPlan - this needs to be done in each test file that uses it
export let mockGetCurrentPlan: jest.Mock;

/**
 * Sets up default mocks for user operations
 */
export function setupUserMocks(userId: string = TEST_USER_ID, credits: number = INITIAL_BALANCE) {
  prismaMock.user.findUnique.mockImplementation(async (args: any) => {
    if (args.where.id === userId) {
      return {
        ...mockUser,
        id: userId,
        credits,
      };
    }
    return null;
  });
}

/**
 * Sets up transaction mocks with specific behavior
 */
export function setupTransactionMocks(userId: string = TEST_USER_ID, initialCredits: number = INITIAL_BALANCE) {
  const mockTx = {
    ...prismaMock,
    user: {
      ...prismaMock.user,
      findUnique: jest.fn().mockImplementation(async (args: any) => {
        if (args.where.id === userId) {
          return {
            id: userId,
            credits: initialCredits,
          };
        }
        return null;
      }),
      update: prismaMock.user.update,
    },
    creditTransaction: {
      ...prismaMock.creditTransaction,
      create: prismaMock.creditTransaction.create,
    },
  };

  prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
    return await callback(mockTx);
  });

  return mockTx;
}

/**
 * Creates a specific transaction mock for one-time use
 */
export function createSpecificTransactionMock(config: {
  userId?: string;
  initialCredits?: number;
  newBalance?: number;
  transactionId?: string;
  shouldUserUpdateFail?: boolean;
  shouldTransactionCreateFail?: boolean;
  userUpdateError?: string;
  transactionCreateError?: string;
  shouldUserNotExist?: boolean;
}) {
  const {
    userId = TEST_USER_ID,
    initialCredits = INITIAL_BALANCE,
    newBalance = initialCredits,
    transactionId = 'mock-tx-id',
    shouldUserUpdateFail = false,
    shouldTransactionCreateFail = false,
    userUpdateError = 'DB error during user update',
    transactionCreateError = 'DB error during creditTransaction create',
    shouldUserNotExist = false,
  } = config;

  return (prismaMock.$transaction as jest.Mock).mockImplementationOnce(async (callback) => {
    const specificMockTx = {
      ...prismaMock,
      user: {
        ...prismaMock.user,
        findUnique: jest.fn().mockResolvedValueOnce(
          shouldUserNotExist ? null : { id: userId, credits: initialCredits }
        ),
        update: shouldUserUpdateFail
          ? jest.fn().mockRejectedValueOnce(new Error(userUpdateError))
          : jest.fn().mockResolvedValueOnce({ id: userId, credits: newBalance }),
      },
      creditTransaction: {
        ...prismaMock.creditTransaction,
        create: shouldTransactionCreateFail
          ? jest.fn().mockRejectedValueOnce(new Error(transactionCreateError))
          : jest.fn().mockResolvedValueOnce({
              id: transactionId,
              userId,
              balanceAfter: newBalance,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
      },
    };
    return await callback(specificMockTx);
  });
}

/**
 * Sets up spy on CreditService.recordTransaction
 */
export function setupRecordTransactionSpy() {
  return jest.spyOn(CreditService, 'recordTransaction').mockImplementation(async (data) => {
    return {
      success: true,
      newBalance: INITIAL_BALANCE + data.amount,
      transactionId: 'mock-tx-id',
    };
  });
}

/**
 * Sets up spy on CreditService.checkUsageLimits
 */
export function setupCheckUsageLimitsSpy() {
  return jest.spyOn(CreditService, 'checkUsageLimits');
}

/**
 * Resets all mocks to their default state
 */
export function resetAllMocks() {
  jest.resetAllMocks();
  setupUserMocks();
  setupTransactionMocks();
}

/**
 * Sets up mocks for usage analytics tests
 */
export function setupUsageAnalyticsMocks() {
  // Reset specific mocks for analytics
  prismaMock.user.findUnique.mockReset();
  prismaMock.creditTransaction.aggregate.mockReset();
  prismaMock.generatedImage.count.mockReset();
  prismaMock.userModel.count.mockReset();
  prismaMock.creditTransaction.findMany.mockReset();
  prismaMock.$queryRaw.mockReset();
}

/**
 * Sets up the getCurrentPlan mock
 */
export function setupGetCurrentPlanMock() {
  const { getCurrentPlan } = require('@/lib/stripe/pricing');
  mockGetCurrentPlan = getCurrentPlan as jest.Mock;
}

/**
 * Creates mock plan and sets up getCurrentPlan mock
 */
export function setupPlanMock(planData: any) {
  if (!mockGetCurrentPlan) {
    setupGetCurrentPlanMock();
  }
  mockGetCurrentPlan.mockReturnValue(planData);
}

/**
 * Assertion helper for successful transaction results
 */
export function expectSuccessfulTransaction(result: any, expectedBalance: number, transactionId?: string) {
  expect(result.success).toBe(true);
  expect(result.newBalance).toBe(expectedBalance);
  if (transactionId) {
    expect(result.transactionId).toBe(transactionId);
  }
}

/**
 * Assertion helper for failed transaction results
 */
export function expectFailedTransaction(result: any, expectedError: string, expectedBalance?: number) {
  expect(result.success).toBe(false);
  expect(result.error).toContain(expectedError);
  if (expectedBalance !== undefined) {
    expect(result.newBalance).toBe(expectedBalance);
  }
} 