// Mock the actual prisma client import path used by CreditService
// This ensures CreditService uses our global mock instead of the real Prisma client.
// The factory function must access global.prismaMock directly due to hoisting.
jest.mock('@/lib/db', () => ({
  prisma: (global as any).prismaMock, // Access global directly here
}));

// Mock getCurrentPlan
jest.mock('@/lib/stripe/pricing', () => ({
  ...jest.requireActual('@/lib/stripe/pricing'),
  getCurrentPlan: jest.fn(),
}));

import { CreditService } from '../../credit-service';
import {
  resetAllMocks,
  setupCheckUsageLimitsSpy,
  setupUsageAnalyticsMocks,
  setupPlanMock,
  setupGetCurrentPlanMock,
  mockGetCurrentPlan,
} from '../utils/credit-test-helpers.utils';
import {
  TEST_USER_ID,
  INITIAL_BALANCE,
  mockPlans,
  mockRecentTransactions,
  mockUsageTrends,
  errorMessages,
} from '../fixtures/credit-test-data.fixtures';

// Access prismaMock from the global scope for use in tests
const prismaMock = (global as any).prismaMock;

describe('CreditService - Notifications & Analytics', () => {
  beforeEach(() => {
    resetAllMocks();
    setupGetCurrentPlanMock();
  });

  describe('getLowCreditNotification', () => {
    let checkUsageLimitsSpy: jest.SpyInstance;

    beforeEach(() => {
      checkUsageLimitsSpy = setupCheckUsageLimitsSpy();
    });

    afterEach(() => {
      checkUsageLimitsSpy.mockRestore();
    });

    it('should return null if user is not near credit limit', async () => {
      checkUsageLimitsSpy.mockResolvedValueOnce({
        isNearLimit: false,
      } as any);

      const notification = await CreditService.getLowCreditNotification(TEST_USER_ID);
      
      expect(notification).toBeNull();
      expect(checkUsageLimitsSpy).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('should return warning notification if user is near limit (e.g., 10 credits)', async () => {
      const creditsRemaining = 10;
      checkUsageLimitsSpy.mockResolvedValueOnce({
        isNearLimit: true,
        currentCredits: creditsRemaining,
      } as any);

      const notification = await CreditService.getLowCreditNotification(TEST_USER_ID);

      expect(notification).toEqual({
        shouldNotify: true,
        message: `You're running low on credits (${creditsRemaining} remaining).`,
        severity: 'warning',
        creditsRemaining: creditsRemaining,
        suggestedAction: 'Consider upgrading your plan or purchasing additional credits.',
      });
    });

    it('should return critical notification if user credits are very low (e.g., 5 credits)', async () => {
      const creditsRemaining = 5;
      checkUsageLimitsSpy.mockResolvedValueOnce({
        isNearLimit: true,
        currentCredits: creditsRemaining,
      } as any);

      const notification = await CreditService.getLowCreditNotification(TEST_USER_ID);

      expect(notification).toEqual({
        shouldNotify: true,
        message: `You have only ${creditsRemaining} credits remaining!`,
        severity: 'critical',
        creditsRemaining: creditsRemaining,
        suggestedAction: 'Purchase more credits or upgrade your plan to continue generating images.',
      });
    });

    it('should return critical notification if user credits are less than 5 (e.g., 3 credits)', async () => {
      const creditsRemaining = 3;
      checkUsageLimitsSpy.mockResolvedValueOnce({
        isNearLimit: true,
        currentCredits: creditsRemaining,
      } as any);

      const notification = await CreditService.getLowCreditNotification(TEST_USER_ID);

      expect(notification).toEqual({
        shouldNotify: true,
        message: `You have only ${creditsRemaining} credits remaining!`,
        severity: 'critical',
        creditsRemaining: creditsRemaining,
        suggestedAction: 'Purchase more credits or upgrade your plan to continue generating images.',
      });
    });

    it('should propagate error if checkUsageLimits throws an error', async () => {
      const errorMessage = 'User not found from checkUsageLimits';
      checkUsageLimitsSpy.mockRejectedValueOnce(new Error(errorMessage));

      await expect(CreditService.getLowCreditNotification(TEST_USER_ID)).rejects.toThrow(errorMessage);
    });
  });

  describe('getUsageAnalytics', () => {
    beforeEach(() => {
      setupUsageAnalyticsMocks();
      mockGetCurrentPlan.mockReset();
    });

    it('should return comprehensive usage analytics for a user with diverse data', async () => {
      const testUserId = 'analytics-user-1';
      const userCreationDate = new Date('2023-01-01T00:00:00.000Z');
      const currentCreditsInDB = 750;
      const planId = 'pro_analytics';

      const mockPlan = mockPlans.pro_analytics;
      setupPlanMock(mockPlan);

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: testUserId,
        credits: currentCreditsInDB,
        subscriptionPlan: planId,
        subscriptionStatus: 'active',
        createdAt: userCreationDate,
      } as any);

      // Mock aggregates and counts in order of Promise.all execution
      // 1. Total Credits Used (spent, all time)
      prismaMock.creditTransaction.aggregate.mockResolvedValueOnce({ _sum: { amount: -500 } });
      // 2. Total Credits Earned (all time)
      prismaMock.creditTransaction.aggregate.mockResolvedValueOnce({ _sum: { amount: 1250 } });
      // 3. Total Images Generated (all time)
      prismaMock.generatedImage.count.mockResolvedValueOnce(25);
      // 4. Total Models Created (all time)
      prismaMock.userModel.count.mockResolvedValueOnce(3);
      // 5. Current Period Credits Used (spent)
      prismaMock.creditTransaction.aggregate.mockResolvedValueOnce({ _sum: { amount: -150 } });
      // 6. Current Period Images Generated
      prismaMock.generatedImage.count.mockResolvedValueOnce(10);
      // 7. Current Period Models Created
      prismaMock.userModel.count.mockResolvedValueOnce(1);
      // 8. Recent Transactions
      prismaMock.creditTransaction.findMany.mockResolvedValueOnce(mockRecentTransactions as any);
      // 9. Usage Trends
      prismaMock.$queryRaw.mockResolvedValueOnce(mockUsageTrends);

      const analytics = await CreditService.getUsageAnalytics(testUserId);

      // Assertions
      expect(mockGetCurrentPlan).toHaveBeenCalledWith(planId);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: testUserId },
        select: expect.anything(),
      });

      // Current Period Assertions
      expect(analytics.currentPeriod.creditsUsed).toBe(150);
      expect(analytics.currentPeriod.creditsRemaining).toBe(currentCreditsInDB);
      expect(analytics.currentPeriod.imagesGenerated).toBe(10);
      expect(analytics.currentPeriod.modelsCreated).toBe(1);
      const expectedPercentage = Math.round((150 / mockPlan.credits) * 100 * 100) / 100;
      expect(analytics.currentPeriod.percentageUsed).toBe(expectedPercentage);

      // All Time Assertions
      expect(analytics.allTime.totalCreditsUsed).toBe(500);
      expect(analytics.allTime.totalCreditsEarned).toBe(1250);
      expect(analytics.allTime.totalImagesGenerated).toBe(25);
      expect(analytics.allTime.totalModelsCreated).toBe(3);
      expect(analytics.allTime.totalSpent).toBe(500 * 0.01);

      // Recent Transactions Assertions
      expect(analytics.recentTransactions).toEqual(
        mockRecentTransactions.map(t => ({ ...t, type: t.type as any }))
      );

      // Usage Trends Assertions
      expect(analytics.usageTrends).toEqual([
        { date: '2023-03-15', creditsUsed: 30, imagesGenerated: 3 },
        { date: '2023-03-10', creditsUsed: 20, imagesGenerated: 2 },
      ]);

      // Check if all aggregate/count mocks were called
      expect(prismaMock.creditTransaction.aggregate).toHaveBeenCalledTimes(3);
      expect(prismaMock.generatedImage.count).toHaveBeenCalledTimes(2);
      expect(prismaMock.userModel.count).toHaveBeenCalledTimes(2);
      expect(prismaMock.creditTransaction.findMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('should return zero/empty analytics for a new user with no activity', async () => {
      const newUserId = 'new-user-99';
      const userCreationDate = new Date();
      const planId = 'free';

      const mockPlan = mockPlans.free;
      setupPlanMock(mockPlan);

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: newUserId,
        credits: 100,
        subscriptionPlan: planId,
        createdAt: userCreationDate,
      } as any);

      // All aggregates/counts return zero/null sum or empty arrays
      prismaMock.creditTransaction.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prismaMock.generatedImage.count.mockResolvedValue(0);
      prismaMock.userModel.count.mockResolvedValue(0);
      prismaMock.creditTransaction.findMany.mockResolvedValue([]);
      prismaMock.$queryRaw.mockResolvedValue([]);

      const analytics = await CreditService.getUsageAnalytics(newUserId);

      expect(analytics.currentPeriod).toEqual({
        creditsUsed: 0,
        creditsRemaining: 100,
        imagesGenerated: 0,
        modelsCreated: 0,
        percentageUsed: 0,
      });
      expect(analytics.allTime).toEqual({
        totalCreditsUsed: 0,
        totalCreditsEarned: 0,
        totalImagesGenerated: 0,
        totalModelsCreated: 0,
        totalSpent: 0,
      });
      expect(analytics.recentTransactions).toEqual([]);
      expect(analytics.usageTrends).toEqual([]);
    });

    it('should throw error if user is not found', async () => {
      const nonExistentUserId = 'ghost-user';
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      await expect(CreditService.getUsageAnalytics(nonExistentUserId)).rejects.toThrow(
        errorMessages.userNotFound
      );

      // Ensure no other prisma calls were made
      expect(prismaMock.creditTransaction.aggregate).not.toHaveBeenCalled();
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    it('should handle percentageUsed correctly for a plan with 0 credits', async () => {
      const userIdWithFreePlan = 'free-user-101';
      const planId = 'free_zero_credit';
      const mockPlanZero = mockPlans.free_zero_credit;
      setupPlanMock(mockPlanZero);

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: userIdWithFreePlan,
        credits: 0,
        subscriptionPlan: planId,
        createdAt: new Date(),
      } as any);

      prismaMock.creditTransaction.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prismaMock.generatedImage.count.mockResolvedValue(0);
      prismaMock.userModel.count.mockResolvedValue(0);
      prismaMock.creditTransaction.findMany.mockResolvedValue([]);
      prismaMock.$queryRaw.mockResolvedValue([]);

      const analytics = await CreditService.getUsageAnalytics(userIdWithFreePlan);
      
      expect(analytics.currentPeriod.percentageUsed).toBe(0); // Avoid division by zero
    });
  });
}); 