import { TrainingService } from '../training-service'
import { HuggingFaceService } from '../huggingface-service'
import { ReplicateService } from '../replicate-service'
import { TrainingStage } from '../training-debug'

// Mock the services and database
jest.mock('../replicate-service')
jest.mock('../huggingface-service')
jest.mock('@/lib/db', () => ({
  prisma: {
    userModel: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    jobQueue: {
      findFirst: jest.fn(),
      update: jest.fn(),
    }
  }
}))

const mockReplicateService = jest.mocked(ReplicateService)
const mockHuggingFaceService = jest.mocked(HuggingFaceService)

describe('Training Upload Detection', () => {
  let trainingService: TrainingService
  let mockReplicateInstance: jest.Mocked<ReplicateService>
  let mockHuggingFaceInstance: jest.Mocked<HuggingFaceService>
  let mockPrisma: any

  beforeEach(async () => {
    jest.clearAllMocks()
    
    // Get the mocked prisma
    const { prisma } = await import('@/lib/db')
    mockPrisma = prisma
    
    // Create mock instances
    mockReplicateInstance = {
      getTrainingStatus: jest.fn(),
      startTraining: jest.fn(),
    } as any

    mockHuggingFaceInstance = {
      uploadModel: jest.fn(),
      getRepoStatus: jest.fn(),
      deleteRepository: jest.fn(),
    } as any

    // Mock the constructors
    mockReplicateService.mockImplementation(() => mockReplicateInstance)
    mockHuggingFaceService.mockImplementation(() => mockHuggingFaceInstance)

    trainingService = new TrainingService()
  })

  describe('Upload Detection After Manual Modifications', () => {
    it('should detect successful HuggingFace upload when model exists but tracking is inconsistent', async () => {
      const trainingId = 'test-upload-detection-123'
      const modelName = 'test-model'
      const huggingFaceRepo = 'testuser/test-model-123'

      // Mock Replicate training as succeeded
      mockReplicateInstance.getTrainingStatus.mockResolvedValue({
        id: trainingId,
        status: 'succeeded',
        output: 'https://replicate.delivery/output/model.safetensors',
        logs: 'Training completed successfully'
      })

      // Mock database to return model with HuggingFace repo
      mockPrisma.userModel.findFirst.mockResolvedValue({
        id: 'model-123',
        huggingfaceRepo: huggingFaceRepo,
        externalTrainingId: trainingId
      })

      // Mock HuggingFace model exists (successful upload was done manually)
      mockHuggingFaceInstance.getRepoStatus.mockResolvedValue({
        id: huggingFaceRepo,
        url: `https://huggingface.co/${huggingFaceRepo}`,
        private: false,
        downloads: 0,
        likes: 0,
        tags: ['flux', 'lora'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        modelReady: true
      })

      // Clear in-memory tracking to simulate server restart or manual modifications
      TrainingService.completedUploads.clear()
      TrainingService.ongoingUploads.clear()

      // First call should detect the existing upload and not trigger a new one
      const status = await trainingService.getTrainingStatus(trainingId, modelName, false)

      // Should detect that upload was already completed
      expect(status.status).toBe('completed')
      expect(status.huggingFaceRepo).toBe(huggingFaceRepo)
      expect(mockHuggingFaceInstance.uploadModel).not.toHaveBeenCalled()
      expect(mockPrisma.userModel.findFirst).toHaveBeenCalledWith({
        where: { externalTrainingId: trainingId }
      })
    })

    it('should handle case where HuggingFace model was deleted after upload', async () => {
      const trainingId = 'test-deleted-model-456'
      const modelName = 'deleted-model'

      // Mock Replicate training as succeeded
      mockReplicateInstance.getTrainingStatus.mockResolvedValue({
        id: trainingId,
        status: 'succeeded',
        output: 'https://replicate.delivery/output/model.safetensors',
        logs: 'Training completed successfully'
      })

      // Mock database to return model with HuggingFace repo
      mockPrisma.userModel.findFirst.mockResolvedValue({
        id: 'model-456',
        huggingfaceRepo: 'testuser/deleted-model-456',
        externalTrainingId: trainingId
      })

      // Mock HuggingFace model doesn't exist (was deleted)
      mockHuggingFaceInstance.getRepoStatus.mockRejectedValue(
        new Error('Failed to get repo status: 404')
      )

      // Mock database update for clearing the repo reference
      mockPrisma.userModel.update.mockResolvedValue({})

      // System should detect that re-upload is needed
      const status = await trainingService.getTrainingStatus(trainingId, modelName, false)

      // Should indicate that upload is needed
      expect(status.status).toBe('uploading')
      expect(status.stage).toContain('ready for upload')
      expect(mockPrisma.userModel.update).toHaveBeenCalledWith({
        where: { id: 'model-456' },
        data: {
          huggingfaceRepo: null,
          huggingfaceStatus: null,
          loraReadyForInference: false
        }
      })
    })

    it('should properly synchronize in-memory tracking with actual HuggingFace state', async () => {
      const trainingId = 'test-sync-789'
      const modelName = 'sync-model'
      const huggingFaceRepo = 'testuser/sync-model-789'

      // Mock Replicate training as succeeded
      mockReplicateInstance.getTrainingStatus.mockResolvedValue({
        id: trainingId,
        status: 'succeeded',
        output: 'https://replicate.delivery/output/model.safetensors',
        logs: 'Training completed successfully'
      })

      // First call: Model doesn't exist in database
      mockPrisma.userModel.findFirst.mockResolvedValueOnce(null)
      mockHuggingFaceInstance.uploadModel.mockResolvedValueOnce({
        repoId: huggingFaceRepo,
        repoUrl: `https://huggingface.co/${huggingFaceRepo}`,
        status: 'completed'
      })

      const firstStatus = await trainingService.getTrainingStatus(trainingId, modelName, true)
      expect(firstStatus.status).toBe('completed')
      expect(mockHuggingFaceInstance.uploadModel).toHaveBeenCalledTimes(1)

      // Second call: Model now exists in database
      mockPrisma.userModel.findFirst.mockResolvedValue({
        id: 'model-789',
        huggingfaceRepo: huggingFaceRepo,
        externalTrainingId: trainingId
      })
      mockHuggingFaceInstance.getRepoStatus.mockResolvedValue({
        id: huggingFaceRepo,
        url: `https://huggingface.co/${huggingFaceRepo}`,
        private: false,
        downloads: 0,
        likes: 0,
        tags: ['flux', 'lora'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        modelReady: true
      })

      const secondStatus = await trainingService.getTrainingStatus(trainingId, modelName, true)
      expect(secondStatus.status).toBe('completed')
      expect(mockHuggingFaceInstance.uploadModel).toHaveBeenCalledTimes(1) // Still only called once
    })
  })

  describe('Database State Synchronization', () => {
    it('should detect when database shows ready but HuggingFace model does not exist', async () => {
      // This test will be implemented after we add the verification logic
      // It should detect inconsistencies between database state and actual HuggingFace state
    })

    it('should detect when HuggingFace model exists but database shows failed', async () => {
      // This test will be implemented after we add the verification logic
      // It should detect when manual upload succeeded but database wasn't updated
    })
  })
}) 