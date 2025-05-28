// Mock the actual prisma client import path used by CreditService
// This ensures CreditService uses our global mock instead of the real Prisma client.
// The factory function must access global.prismaMock directly due to hoisting.
jest.mock('@/lib/db', () => ({
  prisma: (global as any).prismaMock, // Access global directly here
}));

import { CreditService } from '../../credit-service';
import {
  resetAllMocks,
  createSpecificTransactionMock,
  expectSuccessfulTransaction,
  expectFailedTransaction,
} from '../utils/credit-test-helpers';
import {
  TEST_USER_ID,
  INITIAL_BALANCE,
  mockTransactionData,
  errorMessages,
} from '../fixtures/credit-test-data';

// Access prismaMock from the global scope for use in tests
const prismaMock = (global as any).prismaMock;

describe('CreditService - Transaction Operations', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('recordTransaction', () => {
    it('should record a transaction and update user credits correctly', async () => {
      const transactionData = mockTransactionData.spend;
      const expectedNewBalance = INITIAL_BALANCE - 50;

      createSpecificTransactionMock({
        newBalance: expectedNewBalance,
        transactionId: 'trans-1',
      });

      const result = await CreditService.recordTransaction(transactionData);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expectSuccessfulTransaction(result, expectedNewBalance, 'trans-1');
    });

    it('should return success false and error message if user update within transaction fails', async () => {
      const transactionData = mockTransactionData.spend;

      createSpecificTransactionMock({
        shouldUserUpdateFail: true,
        userUpdateError: errorMessages.dbErrorUserUpdate,
      });

      const result = await CreditService.recordTransaction(transactionData);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expectFailedTransaction(result, `${errorMessages.failedToRecord}: ${errorMessages.dbErrorUserUpdate}`);
      expect(result.newBalance).toBeUndefined();
    });

    it('should return success false and error message if credit transaction creation fails', async () => {
      const transactionData = mockTransactionData.earn;

      createSpecificTransactionMock({
        shouldTransactionCreateFail: true,
        transactionCreateError: errorMessages.dbErrorTransactionCreate,
      });

      const result = await CreditService.recordTransaction(transactionData);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expectFailedTransaction(result, `${errorMessages.failedToRecord}: ${errorMessages.dbErrorTransactionCreate}`);
      expect(result.newBalance).toBeUndefined();
    });

    it('should handle user not found within transaction', async () => {
      const transactionData = {
        userId: 'non-existent-user',
        amount: -50,
        type: 'spent' as const,
        description: 'Test spend transaction',
      };

      createSpecificTransactionMock({
        userId: 'non-existent-user',
        shouldUserNotExist: true,
      });

      const result = await CreditService.recordTransaction(transactionData);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expectFailedTransaction(result, `${errorMessages.failedToRecord}: ${errorMessages.userNotFound}`);
    });
  });
}); 