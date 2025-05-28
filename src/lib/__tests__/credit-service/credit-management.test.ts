// Mock the actual prisma client import path used by CreditService
// This ensures CreditService uses our global mock instead of the real Prisma client.
// The factory function must access global.prismaMock directly due to hoisting.
jest.mock('@/lib/db', () => ({
  prisma: (global as any).prismaMock, // Access global directly here
}));

import { CreditService } from '../../credit-service';
import {
  resetAllMocks,
  setupRecordTransactionSpy,
  expectSuccessfulTransaction,
  expectFailedTransaction,
} from '../utils/credit-test-helpers';
import {
  TEST_USER_ID,
  INITIAL_BALANCE,
  mockTransactionData,
  errorMessages,
  transactionTypes,
  relatedEntityTypes,
} from '../fixtures/credit-test-data';

// Access prismaMock from the global scope for use in tests
const prismaMock = (global as any).prismaMock;

describe('CreditService - Credit Management', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('spendCredits', () => {
    const spendAmount = 50;
    const description = 'Image generation cost';
    const relatedEntityType = relatedEntityTypes.image_generation;
    const relatedEntityId = 'img-gen-abc';

    beforeEach(() => {
      setupRecordTransactionSpy();
    });

    it('should spend credits and record transaction if user has sufficient balance', async () => {
      const expectedNewBalance = INITIAL_BALANCE - spendAmount;
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: INITIAL_BALANCE,
      } as any);

      const result = await CreditService.spendCredits(
        TEST_USER_ID,
        spendAmount,
        description,
        relatedEntityType,
        relatedEntityId
      );

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { credits: true },
      });
      expect(CreditService.recordTransaction).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        amount: -spendAmount,
        type: transactionTypes.spent,
        description,
        relatedEntityType,
        relatedEntityId,
        metadata: undefined,
      });
      expectSuccessfulTransaction(result, expectedNewBalance);
    });

    it('should not spend credits or record transaction if user has insufficient balance', async () => {
      const insufficientBalance = spendAmount - 10;
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: insufficientBalance,
      } as any);

      const result = await CreditService.spendCredits(TEST_USER_ID, spendAmount, description);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { credits: true },
      });
      expect(CreditService.recordTransaction).not.toHaveBeenCalled();
      expectFailedTransaction(result, errorMessages.insufficientCredits, insufficientBalance);
    });

    it('should return error if user is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      const result = await CreditService.spendCredits(TEST_USER_ID, spendAmount, description);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { credits: true },
      });
      expect(CreditService.recordTransaction).not.toHaveBeenCalled();
      expectFailedTransaction(result, errorMessages.userNotFound, 0);
    });

    it('should return error if recordTransaction fails by returning success:false', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: INITIAL_BALANCE,
      } as any);

      const recordTransactionErrorMessage = 'DB transaction failed internally';
      (CreditService.recordTransaction as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: recordTransactionErrorMessage,
      });

      const result = await CreditService.spendCredits(TEST_USER_ID, spendAmount, description);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { credits: true },
      });
      expect(CreditService.recordTransaction).toHaveBeenCalledTimes(1);
      expectFailedTransaction(result, recordTransactionErrorMessage, INITIAL_BALANCE);
    });

    it('should return error and newBalance 0 if recordTransaction throws an unexpected error', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: INITIAL_BALANCE,
      } as any);

      const thrownErrorMessage = errorMessages.unexpectedError;
      (CreditService.recordTransaction as jest.Mock).mockRejectedValueOnce(new Error(thrownErrorMessage));

      const result = await CreditService.spendCredits(TEST_USER_ID, spendAmount, description);

      expectFailedTransaction(result, errorMessages.failedToProcess, INITIAL_BALANCE);
    });
  });

  describe('addCredits', () => {
    const addAmount = 100;
    const description = 'Purchased credits';
    const relatedEntityType = relatedEntityTypes.subscription;
    const relatedEntityId = 'sub-xyz';

    beforeEach(() => {
      setupRecordTransactionSpy();
    });

    it('should add credits, record transaction, and return new balance', async () => {
      const type = transactionTypes.purchased;
      const expectedNewBalanceAfterRecord = INITIAL_BALANCE + addAmount;
      const finalBalanceAfterFetch = INITIAL_BALANCE + addAmount + 50;

      (CreditService.recordTransaction as jest.Mock).mockResolvedValueOnce({
        success: true,
        newBalance: expectedNewBalanceAfterRecord,
        transactionId: 'tx-add-123',
      });

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: finalBalanceAfterFetch,
      } as any);

      const result = await CreditService.addCredits(
        TEST_USER_ID,
        addAmount,
        type,
        description,
        relatedEntityType,
        relatedEntityId
      );

      expect(CreditService.recordTransaction).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        amount: addAmount,
        type,
        description,
        relatedEntityType,
        relatedEntityId,
        metadata: undefined,
      });
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { credits: true },
      });
      expectSuccessfulTransaction(result, expectedNewBalanceAfterRecord);
    });

    it('should return error if recordTransaction indicates failure (returns success:false)', async () => {
      const type = transactionTypes.earned;
      const recordTransactionErrorMessage = 'Internal error during credit recording';
      const balanceBeforeFailedAdd = INITIAL_BALANCE;

      (CreditService.recordTransaction as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: recordTransactionErrorMessage,
      });

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: balanceBeforeFailedAdd,
      } as any);

      const result = await CreditService.addCredits(TEST_USER_ID, addAmount, type, description);

      expect(CreditService.recordTransaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { credits: true },
      });
      expectFailedTransaction(result, recordTransactionErrorMessage, balanceBeforeFailedAdd);
    });

    it('should return error and current balance if recordTransaction throws an unexpected error', async () => {
      const type = transactionTypes.subscription_renewal;
      const thrownErrorMessage = 'Boom! Record transaction exploded.';
      const balanceWhenErrorThrown = INITIAL_BALANCE;

      (CreditService.recordTransaction as jest.Mock).mockRejectedValueOnce(new Error(thrownErrorMessage));

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: balanceWhenErrorThrown,
      } as any);

      const result = await CreditService.addCredits(TEST_USER_ID, addAmount, type, description);

      expect(CreditService.recordTransaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { credits: true },
      });
      expectFailedTransaction(result, errorMessages.failedToAdd, balanceWhenErrorThrown);
    });

    it('should return success:true and newBalance from recordTransaction if user is not found by the *second* findUnique (after successful recordTransaction)', async () => {
      const type = transactionTypes.admin_adjustment;
      const balanceFromSuccessfulRecordTransaction = INITIAL_BALANCE + addAmount;
      (CreditService.recordTransaction as jest.Mock).mockResolvedValueOnce({
        success: true,
        newBalance: balanceFromSuccessfulRecordTransaction,
        transactionId: 'tx-add-admin',
      });

      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      const result = await CreditService.addCredits(TEST_USER_ID, addAmount, type, description);

      expect(CreditService.recordTransaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { credits: true },
      });
      expectSuccessfulTransaction(result, balanceFromSuccessfulRecordTransaction);
    });
  });
}); 