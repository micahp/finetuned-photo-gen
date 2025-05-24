import { ReplicateService } from '../replicate-service'
import { ZipCreationService } from '../zip-creation-service'
import { TrainingService } from '../training-service'

// Mock the Replicate client
jest.mock('replicate')

describe('Replicate Validation Fix', () => {
  let replicateService: ReplicateService
  let zipService: ZipCreationService  
  let trainingService: TrainingService

  beforeEach(() => {
    replicateService = new ReplicateService()
    zipService = new ZipCreationService('test-validation-fix')
    trainingService = new TrainingService()
  })

  it('should fail early when zipUrl is not provided, preventing validation errors', async () => {
    // This test verifies our fix: we now fail fast when zipUrl is missing
    // instead of sending invalid data to Replicate and getting validation errors
    const mockTrainingImages = [
      {
        id: '1',
        filename: 'test1.jpg',
        url: 'https://example.com/test1.jpg',
        size: 1024000
      }
    ]

    // Mock Replicate client (shouldn't be called since we fail early)
    const mockReplicateClient = {
      trainings: {
        create: jest.fn() // This should never be called
      }
    }
    
    // Override the private client
    ;(replicateService as any).client = mockReplicateClient

    // This should fail early with a clear error message about missing ZIP URL
    const result = await replicateService.startTraining({
      modelName: 'test-model',
      triggerWord: 'TESTTOKEN',
      trainingImages: mockTrainingImages,
      // zipUrl intentionally not provided - this should fail immediately
      steps: 1000,
      learningRate: 1e-4,
      loraRank: 16
    } as any) // Type assertion needed since zipUrl is now required

    // Verify it fails with clear error about missing ZIP URL
    expect(result.status).toBe('failed')
    expect(result.error).toContain('ZIP URL is required')
    
    // Verify that Replicate API was never called (early failure prevention)
    expect(mockReplicateClient.trainings.create).not.toHaveBeenCalled()
  })

  it('should succeed when proper ZIP URL is provided', async () => {
    const mockTrainingImages = [
      {
        id: '1',
        filename: 'test1.jpg', 
        url: 'https://example.com/test1.jpg',
        size: 1024000
      }
    ]

    // Mock successful Replicate response when ZIP URL is provided
    const mockReplicateClient = {
      trainings: {
        create: jest.fn().mockResolvedValue({
          id: 'training-123',
          status: 'starting',
          urls: {
            get: 'https://api.replicate.com/v1/trainings/training-123'
          }
        })
      },
      models: {
        create: jest.fn().mockResolvedValue({
          id: 'test-model',
          name: 'test-model'
        })
      }
    }

    ;(replicateService as any).client = mockReplicateClient

    // This should succeed because we're providing a proper ZIP URL
    const result = await replicateService.startTraining({
      modelName: 'test-model',
      triggerWord: 'TESTTOKEN', 
      trainingImages: mockTrainingImages,
      zipUrl: 'https://storage.example.com/training-images.zip', // Proper ZIP URL
      steps: 1000,
      learningRate: 1e-4,
      loraRank: 16
    })

    expect(result.status).toBe('starting')
    expect(result.id).toBe('training-123')
  })

  it('should fail training workflow when ZIP creation fails', async () => {
    const mockTrainingImages = [
      {
        id: '1',
        filename: 'test1.jpg',
        url: '/api/uploads/user123/nonexistent.jpg', // This will fail 
        size: 1024000
      }
    ]

    // This should fail during ZIP creation and never reach Replicate
    const result = await trainingService.startTraining({
      modelName: 'test-model',
      triggerWord: 'TESTTOKEN',
      trainingImages: mockTrainingImages,
      userId: 'user123',
      steps: 1000,
      learningRate: 1e-4,
      loraRank: 16
    })

    expect(result.status.status).toBe('failed')
    expect(result.status.error).toContain('ZIP creation failed')
  })
}) 