import { TrainingService } from '../training-service'
import { ZipCreationService } from '../zip-creation-service'
import { ReplicateService } from '../replicate-service'
import { HuggingFaceService } from '../huggingface-service'
import { TrainingDebugger, TrainingStage } from '../training-debug'

// Mock external dependencies
jest.mock('../replicate-service')
jest.mock('../huggingface-service')
jest.mock('../zip-creation-service')

const MockedReplicateService = ReplicateService as jest.MockedClass<typeof ReplicateService>
const MockedHuggingFaceService = HuggingFaceService as jest.MockedClass<typeof HuggingFaceService>
const MockedZipCreationService = ZipCreationService as jest.MockedClass<typeof ZipCreationService>

describe('Training Integration Pipeline', () => {
  let trainingService: TrainingService
  let mockZipService: jest.Mocked<ZipCreationService>
  let mockReplicateService: jest.Mocked<ReplicateService>
  let mockHuggingFaceService: jest.Mocked<HuggingFaceService>

  const mockTrainingImages = [
    { id: '1', filename: 'photo1.jpg', url: 'http://example.com/photo1.jpg', size: 1024000 },
    { id: '2', filename: 'photo2.jpg', url: 'http://example.com/photo2.jpg', size: 1024000 },
    { id: '3', filename: 'photo3.jpg', url: 'http://example.com/photo3.jpg', size: 1024000 },
    { id: '4', filename: 'photo4.jpg', url: 'http://example.com/photo4.jpg', size: 1024000 },
    { id: '5', filename: 'photo5.jpg', url: 'http://example.com/photo5.jpg', size: 1024000 },
  ]

  const mockTrainingParams = {
    modelName: 'test-model',
    triggerWord: 'testword',
    description: 'Test model for integration testing',
    trainingImages: mockTrainingImages,
    userId: 'test-user-123',
    baseModel: 'black-forest-labs/FLUX.1-dev',
    steps: 500,
    learningRate: 1e-4,
    loraRank: 16
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Create proper mock instances
    mockReplicateService = new MockedReplicateService() as jest.Mocked<ReplicateService>
    mockHuggingFaceService = new MockedHuggingFaceService() as jest.Mocked<HuggingFaceService>
    mockZipService = new MockedZipCreationService() as jest.Mocked<ZipCreationService>
    
    // Set up default successful mocks
    mockReplicateService.startTraining = jest.fn()
    mockReplicateService.getTrainingStatus = jest.fn()
    mockReplicateService.cancelTraining = jest.fn()
    
    mockHuggingFaceService.uploadModel = jest.fn()
    
    mockZipService.createTrainingZip = jest.fn()
    
    trainingService = new TrainingService()
    
    // Inject mocked services - we'll need to modify TrainingService to accept this
    // For now, we'll override the private properties
    ;(trainingService as any).replicate = mockReplicateService
    ;(trainingService as any).huggingface = mockHuggingFaceService
    ;(trainingService as any).zipService = mockZipService
  })

  describe('Complete Training Pipeline', () => {
    it('should successfully complete the full training workflow with debugging', async () => {
      const trainingId = 'test-training-123'
      
      // Mock ZIP creation success
      mockZipService.createTrainingZip.mockResolvedValue({
        success: true,
        zipUrl: 'https://storage.example.com/training-images.zip',
        zipPath: '/tmp/training-images.zip',
        totalSize: 5120000,
        imageCount: 5,
        debugData: {
          currentStage: TrainingStage.ZIP_CREATION,
          totalErrors: 0,
          retryableErrors: 0,
          lastError: null,
          stageTimings: [{ stage: TrainingStage.ZIP_CREATION, duration: 5000 }],
          recentLogs: []
        }
      })

      // Mock Replicate training start success  
      mockReplicateService.startTraining.mockResolvedValue({
        id: trainingId,
        status: 'starting',
        urls: {
          get: `https://api.replicate.com/v1/trainings/${trainingId}`,
          cancel: `https://api.replicate.com/v1/trainings/${trainingId}/cancel`
        }
      })

      // Mock Replicate training completion
      mockReplicateService.getTrainingStatus.mockResolvedValue({
        id: trainingId,
        status: 'succeeded',
        output: 'https://replicate.delivery/output/model.safetensors',
        logs: 'Training completed successfully'
      })

      // Mock HuggingFace upload success - fix interface to match actual structure
      mockHuggingFaceService.uploadModel.mockResolvedValue({
        repoId: 'test-user/test-model',
        repoUrl: 'https://huggingface.co/test-user/test-model',
        status: 'completed',
        debugData: {
          currentStage: TrainingStage.HUGGINGFACE_UPLOAD,
          totalErrors: 0,
          retryableErrors: 0,
          lastError: null,
          stageTimings: [{ stage: TrainingStage.HUGGINGFACE_UPLOAD, duration: 10000 }],
          recentLogs: []
        }
      })

      // Start training
      const startResult = await trainingService.startTraining(mockTrainingParams)
      
      expect(startResult.trainingId).toBe(trainingId)
      expect(startResult.status.status).toBe('starting')
      expect(startResult.status.stage).toContain('Training environment prepared')

      // Verify ZIP creation was called with correct parameters
      expect(mockZipService.createTrainingZip).toHaveBeenCalledWith(mockTrainingImages)

      // Verify Replicate training was started with ZIP URL
      expect(mockReplicateService.startTraining).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: mockTrainingParams.modelName,
          triggerWord: mockTrainingParams.triggerWord,
          trainingImages: mockTrainingImages,
          zipUrl: 'https://storage.example.com/training-images.zip',
          steps: mockTrainingParams.steps,
          learningRate: mockTrainingParams.learningRate,
          loraRank: mockTrainingParams.loraRank
        })
      )

      // Simulate training completion check
      const statusResult = await trainingService.getTrainingStatus(trainingId, mockTrainingParams.modelName, true)
      
      expect(statusResult.status).toBe('completed')
      expect(statusResult.progress).toBe(100)
      expect(statusResult.huggingFaceRepo).toBe('test-user/test-model')
      expect(statusResult.stage).toContain('completed')

      // Verify HuggingFace upload was called
      expect(mockHuggingFaceService.uploadModel).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: expect.stringContaining('test-model'),
          modelPath: 'https://replicate.delivery/output/model.safetensors',
          description: expect.stringContaining('Custom FLUX LoRA model'),
          tags: expect.arrayContaining(['flux', 'lora', 'text-to-image']),
          isPrivate: false
        })
      )
    })

    it('should handle ZIP creation failure with proper debugging', async () => {
      // Mock ZIP creation failure
      mockZipService.createTrainingZip.mockResolvedValue({
        success: false,
        error: 'Failed to download training images',
        debugData: {
          currentStage: TrainingStage.ZIP_CREATION,
          totalErrors: 3,
          retryableErrors: 2,
          lastError: {
            stage: TrainingStage.ZIP_CREATION,
            category: 'network',
            message: 'Network timeout during image download',
            timestamp: new Date().toISOString(),
            trainingId: 'test-training-123',
            retryable: true
          },
          stageTimings: [{ stage: TrainingStage.ZIP_CREATION, duration: null }],
          recentLogs: []
        }
      })

      const startResult = await trainingService.startTraining(mockTrainingParams)
      
      // Now ZIP creation failure should be properly handled
      expect(startResult.status.status).toBe('failed')
      expect(startResult.status.error).toContain('ZIP creation failed')
      expect(startResult.status.stage).toContain('Failed')
    })

    it('should handle Replicate training failure with retry logic', async () => {
      // Mock successful ZIP creation
      mockZipService.createTrainingZip.mockResolvedValue({
        success: true,
        zipUrl: 'https://storage.example.com/training-images.zip',
        totalSize: 5120000,
        imageCount: 5
      })

      // Mock Replicate training failure
      mockReplicateService.startTraining.mockResolvedValue({
        id: 'failed-training-123',
        status: 'failed',
        error: 'GPU capacity exceeded'
      })

      const startResult = await trainingService.startTraining(mockTrainingParams)
      
      expect(startResult.status.status).toBe('failed')
      expect(startResult.status.error).toContain('GPU capacity exceeded')
    })

    it('should handle HuggingFace upload failure after successful training', async () => {
      const trainingId = 'test-training-456'
      
      // Mock successful ZIP and Replicate training
      mockZipService.createTrainingZip.mockResolvedValue({
        success: true,
        zipUrl: 'https://storage.example.com/training-images.zip',
        totalSize: 5120000,
        imageCount: 5
      })

      mockReplicateService.startTraining.mockResolvedValue({
        id: trainingId,
        status: 'starting'
      })

      mockReplicateService.getTrainingStatus.mockResolvedValue({
        id: trainingId,
        status: 'succeeded',
        output: 'https://replicate.delivery/output/model.safetensors'
      })

      // Mock HuggingFace upload failure - fix interface structure
      mockHuggingFaceService.uploadModel.mockResolvedValue({
        repoId: `test-user/${mockTrainingParams.modelName}`,
        repoUrl: '',
        status: 'failed',
        error: 'Authentication failed',
        debugData: {
          currentStage: TrainingStage.HUGGINGFACE_UPLOAD,
          totalErrors: 1,
          retryableErrors: 0,
          lastError: {
            stage: TrainingStage.HUGGINGFACE_UPLOAD,
            category: 'authentication',
            message: 'Invalid HuggingFace token',
            timestamp: new Date().toISOString(),
            trainingId: trainingId,
            retryable: false
          },
          stageTimings: [],
          recentLogs: []
        }
      })

      await trainingService.startTraining(mockTrainingParams)
      const statusResult = await trainingService.getTrainingStatus(trainingId, mockTrainingParams.modelName, true)
      
      expect(statusResult.status).toBe('failed')
      expect(statusResult.error).toContain('Authentication failed')
      expect(statusResult.progress).toBe(95) // Almost complete but failed at upload
    })

    it('should not trigger multiple uploads for the same completed training', async () => {
      const trainingId = 'test-training-no-duplicate'
      
      // Mock successful ZIP and Replicate training
      mockZipService.createTrainingZip.mockResolvedValue({
        success: true,
        zipUrl: 'https://storage.example.com/training-images.zip',
        totalSize: 5120000,
        imageCount: 5
      })

      mockReplicateService.startTraining.mockResolvedValue({
        id: trainingId,
        status: 'starting'
      })

      mockReplicateService.getTrainingStatus.mockResolvedValue({
        id: trainingId,
        status: 'succeeded',
        output: 'https://replicate.delivery/output/model.safetensors'
      })

      mockHuggingFaceService.uploadModel.mockResolvedValue({
        repoId: `test-user/${mockTrainingParams.modelName}`,
        repoUrl: 'https://huggingface.co/test-user/test-model',
        status: 'completed'
      })

      // First call with allowUpload=true should trigger upload
      const firstResult = await trainingService.getTrainingStatus(trainingId, mockTrainingParams.modelName, true)
      expect(firstResult.status).toBe('completed')
      expect(mockHuggingFaceService.uploadModel).toHaveBeenCalledTimes(1)

      // Second call with allowUpload=true should NOT trigger another upload
      const secondResult = await trainingService.getTrainingStatus(trainingId, mockTrainingParams.modelName, true)
      expect(secondResult.status).toBe('completed')
      expect(mockHuggingFaceService.uploadModel).toHaveBeenCalledTimes(1) // Still only called once

      // Call with allowUpload=false should also not trigger upload
      const thirdResult = await trainingService.getTrainingStatus(trainingId, mockTrainingParams.modelName, false)
      expect(thirdResult.status).toBe('completed')
      expect(mockHuggingFaceService.uploadModel).toHaveBeenCalledTimes(1) // Still only called once
    })
  })

  describe('Training Parameter Validation', () => {
    it('should validate minimum required images', () => {
      const invalidParams = {
        ...mockTrainingParams,
        trainingImages: mockTrainingImages.slice(0, 2) // Only 2 images
      }

      const validation = trainingService.validateTrainingParams(invalidParams)
      
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('At least 3 training images are required')
    })

    it('should validate maximum allowed images', () => {
      const tooManyImages = Array.from({ length: 25 }, (_, i) => ({
        id: `img-${i}`,
        filename: `photo${i}.jpg`,
        url: `http://example.com/photo${i}.jpg`,
        size: 1024000
      }))

      const invalidParams = {
        ...mockTrainingParams,
        trainingImages: tooManyImages
      }

      const validation = trainingService.validateTrainingParams(invalidParams)
      
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Maximum 20 training images allowed')
    })
  })

  describe('Debug Data Integration', () => {
    it('should include comprehensive debug data in training status when implemented', async () => {
      // This test is for future implementation when we add debugData to TrainingStatus
      const trainingId = 'debug-test-123'
      
      // Mock successful Replicate flow
      mockReplicateService.startTraining.mockResolvedValue({
        id: trainingId,
        status: 'starting'
      })
      
      mockReplicateService.getTrainingStatus.mockResolvedValue({
        id: trainingId,
        status: 'processing',
        logs: 'Training in progress'
      })

      // Mock successful ZIP creation 
      mockZipService.createTrainingZip.mockResolvedValue({
        success: true,
        zipUrl: 'https://storage.example.com/training-images.zip',
        totalSize: 5120000,
        imageCount: 5
      })
      
      const startResult = await trainingService.startTraining(mockTrainingParams)
      const statusResult = await trainingService.getTrainingStatus(trainingId, mockTrainingParams.modelName)
      
      // Verify debug data is included
      expect(startResult.status.debugData).toBeDefined()
      expect(statusResult.debugData).toBeDefined()
      expect(statusResult.status).toBeDefined()
      expect(statusResult.stage).toBeDefined()
    })

    it('should track stage progression through the pipeline when implemented', async () => {
      // This test will pass when we implement the full pipeline integration
      const trainingId = 'stage-test-123'
      
      // Mock successful flow
      mockReplicateService.startTraining.mockResolvedValue({
        id: trainingId,
        status: 'starting'
      })

      // Mock successful ZIP creation 
      mockZipService.createTrainingZip.mockResolvedValue({
        success: true,
        zipUrl: 'https://storage.example.com/training-images.zip',
        totalSize: 5120000,
        imageCount: 5
      })
      
      await trainingService.startTraining(mockTrainingParams)
      
      // Basic verification that training starts with proper stage tracking
      expect(mockZipService.createTrainingZip).toHaveBeenCalled()
      expect(mockReplicateService.startTraining).toHaveBeenCalled()
    })
  })
}) 