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
  setupPlanMock,
  setupGetCurrentPlanMock,
  mockGetCurrentPlan,
} from '../utils/credit-test-helpers.utils';
import {
  TEST_USER_ID,
  INITIAL_BALANCE,
  mockPlans,
  errorMessages,
} from '../fixtures/credit-test-data.fixtures';

// Access prismaMock from the global scope for use in tests
const prismaMock = (global as any).prismaMock;

describe('CreditService - Balance & Limits', () => {
  beforeEach(() => {
    resetAllMocks();
    setupGetCurrentPlanMock();
  });

  describe('canAfford', () => {
    const creditCost = 100;

    it('should return true if user has more credits than cost', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: creditCost + 50,
      } as any);
      
      const result = await CreditService.canAfford(TEST_USER_ID, creditCost);
      
      expect(result).toBe(true);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { credits: true },
      });
    });

    it('should return true if user has exact credits as cost', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: creditCost,
      } as any);
      
      const result = await CreditService.canAfford(TEST_USER_ID, creditCost);
      
      expect(result).toBe(true);
    });

    it('should return false if user has fewer credits than cost', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: creditCost - 10,
      } as any);
      
      const result = await CreditService.canAfford(TEST_USER_ID, creditCost);
      
      expect(result).toBe(false);
    });

    it('should return false if user is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      
      const result = await CreditService.canAfford(TEST_USER_ID, creditCost);
      
      expect(result).toBe(false);
    });

    it('should return true if creditCost is 0, even if user has 0 credits', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: 0,
      } as any);
      
      const result = await CreditService.canAfford(TEST_USER_ID, 0);
      
      expect(result).toBe(true);
    });

    it('should return false if creditCost is 0 and user is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      
      const result = await CreditService.canAfford(TEST_USER_ID, 0);
      
      expect(result).toBe(false);
    });
  });

  describe('checkUsageLimits', () => {
    beforeEach(() => {
      mockGetCurrentPlan.mockReset();
      prismaMock.user.findUnique.mockReset();
      prismaMock.userModel.count.mockReset();
    });

    it('should return correct usage limits for a typical user', async () => {
      const userCredits = 500;
      const planCredits = 1000;
      const planModels = 10;
      const userModelsCount = 2;
      const expectedWarningThreshold = Math.floor(planCredits * 0.1);

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: userCredits,
        subscriptionPlan: 'pro',
      } as any);
      
      setupPlanMock({
        id: 'pro',
        credits: planCredits,
        maxModels: planModels,
      });
      
      prismaMock.userModel.count.mockResolvedValueOnce(userModelsCount);

      const limits = await CreditService.checkUsageLimits(TEST_USER_ID);

      expect(mockGetCurrentPlan).toHaveBeenCalledWith('pro');
      expect(prismaMock.userModel.count).toHaveBeenCalledWith({ where: { userId: TEST_USER_ID } });
      expect(limits).toEqual({
        maxCreditsPerMonth: planCredits,
        maxModels: planModels,
        currentCredits: userCredits,
        currentModels: userModelsCount,
        canCreateModel: userModelsCount < planModels,
        canGenerateImage: userCredits > 0,
        warningThreshold: expectedWarningThreshold,
        isNearLimit: userCredits <= expectedWarningThreshold,
      });
    });

    it('should indicate cannot create model if user is at model limit', async () => {
      const planCredits = 1000;
      const planModels = 10;

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: 500,
        subscriptionPlan: 'pro',
      } as any);
      
      setupPlanMock({ id: 'pro', credits: planCredits, maxModels: planModels });
      prismaMock.userModel.count.mockResolvedValueOnce(planModels);

      const limits = await CreditService.checkUsageLimits(TEST_USER_ID);

      expect(limits.canCreateModel).toBe(false);
      expect(limits.currentModels).toBe(planModels);
    });

    it('should indicate cannot generate image if user has zero credits', async () => {
      const planCredits = 1000;
      const planModels = 10;
      const expectedWarningThreshold = Math.floor(planCredits * 0.1);

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: 0,
        subscriptionPlan: 'pro',
      } as any);
      
      setupPlanMock({ id: 'pro', credits: planCredits, maxModels: planModels });
      prismaMock.userModel.count.mockResolvedValueOnce(0);

      const limits = await CreditService.checkUsageLimits(TEST_USER_ID);

      expect(limits.canGenerateImage).toBe(false);
      expect(limits.currentCredits).toBe(0);
      expect(limits.isNearLimit).toBe(true);
      expect(limits.warningThreshold).toBe(expectedWarningThreshold);
    });

    it('should indicate isNearLimit if credits are below warning threshold', async () => {
      const planCredits = 1000;
      const warningThreshold = Math.floor(planCredits * 0.1);
      const userCreditsNearLimit = warningThreshold - 10;

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: userCreditsNearLimit,
        subscriptionPlan: 'pro',
      } as any);
      
      setupPlanMock({ id: 'pro', credits: planCredits, maxModels: 10 });
      prismaMock.userModel.count.mockResolvedValueOnce(0);

      const limits = await CreditService.checkUsageLimits(TEST_USER_ID);

      expect(limits.isNearLimit).toBe(true);
      expect(limits.currentCredits).toBe(userCreditsNearLimit);
    });

    it('should indicate isNearLimit if credits are exactly at warning threshold', async () => {
      const planCredits = 1000;
      const warningThreshold = Math.floor(planCredits * 0.1);

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: warningThreshold,
        subscriptionPlan: 'pro',
      } as any);
      
      setupPlanMock({ id: 'pro', credits: planCredits, maxModels: 10 });
      prismaMock.userModel.count.mockResolvedValueOnce(0);

      const limits = await CreditService.checkUsageLimits(TEST_USER_ID);
      
      expect(limits.isNearLimit).toBe(true);
    });

    it('should throw error if user is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      await expect(CreditService.checkUsageLimits(TEST_USER_ID)).rejects.toThrow(errorMessages.userNotFound);
      expect(mockGetCurrentPlan).not.toHaveBeenCalled();
      expect(prismaMock.userModel.count).not.toHaveBeenCalled();
    });

    it('should handle plan with zero credits correctly', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: 10,
        subscriptionPlan: 'free_tier',
      } as any);
      
      setupPlanMock(mockPlans.free_tier);
      prismaMock.userModel.count.mockResolvedValueOnce(0);

      const limits = await CreditService.checkUsageLimits(TEST_USER_ID);

      expect(limits.maxCreditsPerMonth).toBe(0);
      expect(limits.maxModels).toBe(0);
      expect(limits.currentCredits).toBe(10);
      expect(limits.currentModels).toBe(0);
      expect(limits.canCreateModel).toBe(false);
      expect(limits.canGenerateImage).toBe(true);
      expect(limits.warningThreshold).toBe(0);
      expect(limits.isNearLimit).toBe(false);
    });

    it('should handle plan with zero models correctly', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: TEST_USER_ID,
        credits: 100,
        subscriptionPlan: 'no_model_plan',
      } as any);
      
      setupPlanMock(mockPlans.no_model_plan);
      prismaMock.userModel.count.mockResolvedValueOnce(0);

      const limits = await CreditService.checkUsageLimits(TEST_USER_ID);

      expect(limits.maxModels).toBe(0);
      expect(limits.canCreateModel).toBe(false);
    });
  });
}); 