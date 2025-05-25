import { TrainingService } from '@/lib/training-service'
import { ReplicateService } from '@/lib/replicate-service'
import { HuggingFaceService } from '@/lib/huggingface-service'

// Mock the services
jest.mock('@/lib/replicate-service')
jest.mock('@/lib/huggingface-service')
jest.mock('@/lib/db', () => ({
  prisma: {
    userModel: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    jobQueue: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}))

const mockReplicateService = ReplicateService as jest.MockedClass<typeof ReplicateService>
const mockHuggingFaceService = HuggingFaceService as jest.MockedClass<typeof HuggingFaceService>

describe('Automatic HuggingFace Upload', () => {
  let trainingService: TrainingService
  let mockReplicateInstance: jest.Mocked<ReplicateService>
  let mockHuggingFaceInstance: jest.Mocked<HuggingFaceService>

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Clear in-memory tracking
    TrainingService.ongoingUploads.clear()
    TrainingService.completedUploads.clear()

    // Create mock instances
    mockReplicateInstance = {
      getTrainingStatus: jest.fn(),
      startTraining: jest.fn(),
    } as any

    mockHuggingFaceInstance = {
      uploadModel: jest.fn(),
      getRepoStatus: jest.fn(),
    } as any

    // Mock the constructors to return our mock instances
    mockReplicateService.mockImplementation(() => mockReplicateInstance)
    mockHuggingFaceService.mockImplementation(() => mockHuggingFaceInstance)

    trainingService = new TrainingService()
  })

  describe('API Endpoint Automatic Upload Behavior', () => {
    it('should automatically trigger HuggingFace upload when Replicate training succeeds', async () => {
      const trainingId = 'test-auto-upload-123'
      const modelName = 'auto-upload-test-model'

      // Mock Replicate training as succeeded
      mockReplicateInstance.getTrainingStatus.mockResolvedValue({
        id: trainingId,
        status: 'succeeded',
        output: 'https://replicate.delivery/output/model.safetensors',
        logs: 'Training completed successfully'
      })

      // Mock database to return model without HuggingFace repo (needs upload)
      const { prisma } = require('@/lib/db')
      prisma.userModel.findFirst.mockResolvedValue({
        id: 'model-123',
        status: 'training',
        huggingfaceRepo: null,
        loraReadyForInference: false,
        trainingCompletedAt: null,
        externalTrainingId: trainingId
      })

      prisma.jobQueue.findFirst.mockResolvedValue({
        status: 'running',
        errorMessage: null,
        completedAt: null
      })

      // Mock successful HuggingFace upload
      mockHuggingFaceInstance.uploadModel.mockResolvedValue({
        repoId: `testuser/${modelName}-123456`,
        repoUrl: `https://huggingface.co/testuser/${modelName}-123456`,
        status: 'completed'
      })

      // Call getTrainingStatus with allowUpload=true (simulating API behavior)
      const result = await trainingService.getTrainingStatus(trainingId, modelName, true)

      // Verify that upload was triggered automatically
      expect(mockHuggingFaceInstance.uploadModel).toHaveBeenCalledTimes(1)
      expect(mockHuggingFaceInstance.uploadModel).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: expect.stringContaining(modelName),
          modelPath: 'https://replicate.delivery/output/model.safetensors',
          description: expect.stringContaining(modelName),
          tags: ['flux', 'lora', 'text-to-image', 'custom'],
          isPrivate: false
        })
      )

      // Verify the result shows completed status
      expect(result.status).toBe('completed')
      expect(result.huggingFaceRepo).toBe(`testuser/${modelName}-123456`)
      expect(result.stage).toContain('Training completed successfully and model uploaded to HuggingFace')
    })

    it('should NOT trigger upload when allowUpload=false (current broken behavior)', async () => {
      const trainingId = 'test-no-auto-upload-456'
      const modelName = 'no-auto-upload-test-model'

      // Mock Replicate training as succeeded
      mockReplicateInstance.getTrainingStatus.mockResolvedValue({
        id: trainingId,
        status: 'succeeded',
        output: 'https://replicate.delivery/output/model.safetensors',
        logs: 'Training completed successfully'
      })

      // Mock database to return model without HuggingFace repo (needs upload)
      const { prisma } = require('@/lib/db')
      prisma.userModel.findFirst.mockResolvedValue({
        id: 'model-456',
        status: 'training',
        huggingfaceRepo: null,
        loraReadyForInference: false,
        trainingCompletedAt: null,
        externalTrainingId: trainingId
      })

      prisma.jobQueue.findFirst.mockResolvedValue({
        status: 'running',
        errorMessage: null,
        completedAt: null
      })

      // Call getTrainingStatus with allowUpload=false (current API behavior)
      const result = await trainingService.getTrainingStatus(trainingId, modelName, false)

      // Verify that upload was NOT triggered (this is the current broken behavior)
      expect(mockHuggingFaceInstance.uploadModel).not.toHaveBeenCalled()

      // Result should show uploading status (ready for upload but not uploaded)
      expect(result.status).toBe('uploading')
      expect(result.stage).toContain('Training completed successfully, ready for upload to HuggingFace')
      expect(result.debugData.needsUpload).toBe(true)
    })

    it('should prevent duplicate uploads when called multiple times', async () => {
      const trainingId = 'test-duplicate-prevention-789'
      const modelName = 'duplicate-prevention-test-model'

      // Mock Replicate training as succeeded
      mockReplicateInstance.getTrainingStatus.mockResolvedValue({
        id: trainingId,
        status: 'succeeded',
        output: 'https://replicate.delivery/output/model.safetensors',
        logs: 'Training completed successfully'
      })

      // Mock database to return model without HuggingFace repo (needs upload)
      const { prisma } = require('@/lib/db')
      prisma.userModel.findFirst.mockResolvedValue({
        id: 'model-789',
        status: 'training',
        huggingfaceRepo: null,
        loraReadyForInference: false,
        trainingCompletedAt: null,
        externalTrainingId: trainingId
      })

      prisma.jobQueue.findFirst.mockResolvedValue({
        status: 'running',
        errorMessage: null,
        completedAt: null
      })

      // Mock successful HuggingFace upload
      mockHuggingFaceInstance.uploadModel.mockResolvedValue({
        repoId: `testuser/${modelName}-789123`,
        repoUrl: `https://huggingface.co/testuser/${modelName}-789123`,
        status: 'completed'
      })

      // Call getTrainingStatus multiple times with allowUpload=true
      const result1 = await trainingService.getTrainingStatus(trainingId, modelName, true)
      const result2 = await trainingService.getTrainingStatus(trainingId, modelName, true)
      const result3 = await trainingService.getTrainingStatus(trainingId, modelName, true)

      // Verify that upload was only triggered once
      expect(mockHuggingFaceInstance.uploadModel).toHaveBeenCalledTimes(1)

      // All results should show completed status
      expect(result1.status).toBe('completed')
      expect(result2.status).toBe('completed')
      expect(result3.status).toBe('completed')
    })

    it('should now automatically upload when API endpoints call with allowUpload=true (FIXED BEHAVIOR)', async () => {
      const trainingId = 'test-fixed-auto-upload-999'
      const modelName = 'fixed-auto-upload-test-model'

      // Mock Replicate training as succeeded
      mockReplicateInstance.getTrainingStatus.mockResolvedValue({
        id: trainingId,
        status: 'succeeded',
        output: 'https://replicate.delivery/output/model.safetensors',
        logs: 'Training completed successfully'
      })

      // Mock database to return model without HuggingFace repo (needs upload)
      const { prisma } = require('@/lib/db')
      prisma.userModel.findFirst.mockResolvedValue({
        id: 'model-999',
        status: 'training',
        huggingfaceRepo: null,
        loraReadyForInference: false,
        trainingCompletedAt: null,
        externalTrainingId: trainingId
      })

      prisma.jobQueue.findFirst.mockResolvedValue({
        status: 'running',
        errorMessage: null,
        completedAt: null
      })

      // Mock successful HuggingFace upload
      mockHuggingFaceInstance.uploadModel.mockResolvedValue({
        repoId: `testuser/${modelName}-999456`,
        repoUrl: `https://huggingface.co/testuser/${modelName}-999456`,
        status: 'completed'
      })

      // Simulate the FIXED API behavior: allowUpload=true
      const result = await trainingService.getTrainingStatus(trainingId, modelName, true)

      // Verify that upload was triggered automatically (FIXED!)
      expect(mockHuggingFaceInstance.uploadModel).toHaveBeenCalledTimes(1)
      expect(mockHuggingFaceInstance.uploadModel).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: expect.stringContaining(modelName),
          modelPath: 'https://replicate.delivery/output/model.safetensors',
          description: expect.stringContaining(modelName),
          tags: ['flux', 'lora', 'text-to-image', 'custom'],
          isPrivate: false
        })
      )

      // Verify the result shows completed status
      expect(result.status).toBe('completed')
      expect(result.huggingFaceRepo).toBe(`testuser/${modelName}-999456`)
      expect(result.stage).toContain('Training completed successfully and model uploaded to HuggingFace')
    })
  })
}) 