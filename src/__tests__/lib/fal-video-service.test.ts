import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { FalVideoService, type VideoGenerationParams } from '../../lib/fal-video-service'
import { VIDEO_MODELS } from '../../lib/video-models'

// Mock the fal.ai client
jest.mock('@fal-ai/client', () => ({
  fal: {
    config: jest.fn(),
    queue: {
      submit: jest.fn(),
      status: jest.fn(),
      result: jest.fn(),
    },
    run: jest.fn(),
  },
}))

// Mock the cloud storage service
jest.mock('../../lib/cloud-storage', () => ({
  CloudStorageService: jest.fn().mockImplementation(() => ({
    uploadFile: jest.fn().mockResolvedValue({
      url: 'https://test-bucket.com/videos/test-video.mp4',
      size: 1024000,
    }),
    downloadAndUpload: jest.fn().mockResolvedValue({
      videoUrl: 'https://test-bucket.com/videos/test-video.mp4',
      thumbnailUrl: 'https://test-bucket.com/videos/test-video-thumb.jpg',
      fileSize: 1024000,
    }),
  })),
}))

// Mock the image processing service
jest.mock('../../lib/image-processing-service', () => ({
  ImageProcessingService: jest.fn().mockImplementation(() => ({
    detectImageMimeType: jest.fn().mockReturnValue('image/jpeg'),
  })),
}))

describe('FalVideoService', () => {
  let falVideoService: FalVideoService
  let mockFal: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Get the mocked fal client
    mockFal = require('@fal-ai/client').fal
    
    // Create service instance
    falVideoService = new FalVideoService('test-api-key')
  })

  describe('Constructor', () => {
    it('should initialize with API key', () => {
      expect(falVideoService).toBeInstanceOf(FalVideoService)
      expect(mockFal.config).toHaveBeenCalledWith({
        credentials: 'test-api-key',
      })
    })

    it('should throw error if no API key provided', () => {
      // Temporarily remove FAL_API_TOKEN from env
      const originalEnv = process.env.FAL_API_TOKEN
      delete process.env.FAL_API_TOKEN

      expect(() => new FalVideoService()).toThrow('Fal.ai API key is required')

      // Restore env
      if (originalEnv) {
        process.env.FAL_API_TOKEN = originalEnv
      }
    })
  })

  describe('Model Configuration', () => {
    it('should return all available models', () => {
      const models = falVideoService.getAvailableModels()
      expect(models).toEqual(VIDEO_MODELS)
    })

    it('should return specific model config', () => {
      const seedanceModel = falVideoService.getModelConfig('seedance-lite-text')
      expect(seedanceModel).toBeDefined()
      expect(seedanceModel?.name).toContain('Seedance')
    })

    it('should return null for invalid model', () => {
      const invalidModel = falVideoService.getModelConfig('invalid-model')
      expect(invalidModel).toBeNull()
    })

    it('should validate aspect ratio support', () => {
      const seedanceModel = falVideoService.getModelConfig('seedance-lite-text')
      expect(seedanceModel).toBeDefined()
      
      if (seedanceModel) {
        expect(falVideoService.isAspectRatioSupported('seedance-lite-text', '16:9')).toBe(true)
        expect(falVideoService.isAspectRatioSupported('seedance-lite-text', '9:16')).toBe(true)
        expect(falVideoService.isAspectRatioSupported('seedance-lite-text', 'invalid')).toBe(false)
      }
    })
  })

  describe('Video Generation - Queue Submission (Primary Path)', () => {
    it('should submit Seedance text-to-video job to queue', async () => {
      const mockSubmitResult = {
        request_id: 'req_test_123',
        status: 'IN_QUEUE',
      }
      mockFal.queue.submit.mockResolvedValue(mockSubmitResult)

      const params: VideoGenerationParams = {
        prompt: 'A cat playing in a sunny garden',
        modelId: 'seedance-lite-text',
        duration: 5,
        aspectRatio: '16:9',
      }

      const result = await falVideoService.generateVideo(params)

      expect(result).toEqual({
        id: 'req_test_123',
        status: 'processing',
      })

      expect(mockFal.queue.submit).toHaveBeenCalledWith(
        expect.stringContaining('seedance'),
        {
          input: {
            prompt: 'A cat playing in a sunny garden',
            duration: '5',
            resolution: '480p',
            camera_fixed: false,
            aspect_ratio: '16:9',
          },
        }
      )
    })

    it('should submit Seedance image-to-video job to queue', async () => {
      const mockSubmitResult = {
        request_id: 'req_test_456',
        status: 'IN_QUEUE',
      }
      mockFal.queue.submit.mockResolvedValue(mockSubmitResult)

      const imageBuffer = Buffer.from('fake-image-data')
      const params: VideoGenerationParams = {
        prompt: 'Smooth camera movement',
        modelId: 'seedance-lite-image',
        duration: 5,
        imageBuffer,
      }

      const result = await falVideoService.generateVideo(params)

      expect(result).toEqual({
        id: 'req_test_456',
        status: 'processing',
      })

      expect(mockFal.queue.submit).toHaveBeenCalledWith(
        expect.stringContaining('seedance'),
        {
          input: {
            prompt: 'Smooth camera movement. Create a cinematic video with smooth motion, natural lighting, and dynamic camera movement.',
            duration: '5',
            resolution: '480p',
            camera_fixed: false,
            image_url: 'data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh',
          },
        }
      )
    })

    it('should submit non-Seedance model job to queue', async () => {
      const mockSubmitResult = {
        request_id: 'req_test_789',
        status: 'IN_QUEUE',
      }
      mockFal.queue.submit.mockResolvedValue(mockSubmitResult)

      const params: VideoGenerationParams = {
        prompt: 'A beautiful sunset',
        modelId: 'hailuo-video',
        duration: 6,
        aspectRatio: '16:9',
        fps: 24,
        motionLevel: 7,
      }

      const result = await falVideoService.generateVideo(params)

      expect(result).toEqual({
        id: 'req_test_789',
        status: 'processing',
      })

      expect(mockFal.queue.submit).toHaveBeenCalledWith(
        expect.stringContaining('hailuo'),
        {
          input: {
            prompt: 'A beautiful sunset',
            duration_seconds: 6,
            aspect_ratio: '16:9',
            fps: 24,
            motion_bucket_id: 7,
            width: 1344,
            height: 768,
          },
        }
      )
    })
  })

  describe('Video Generation - Fallback to Sync', () => {
    it('should fallback to sync generation when queue submission fails', async () => {
      // Mock queue submission failure
      mockFal.queue.submit.mockRejectedValue(new Error('Queue full'))
      
      // Mock successful sync generation
      const mockSyncResult = {
        request_id: 'sync_req_123',
        video: {
          url: 'https://fal.ai/temp/video.mp4',
          width: 1344,
          height: 768,
        },
        image: {
          url: 'https://fal.ai/temp/thumb.jpg',
        },
      }
      mockFal.run.mockResolvedValue(mockSyncResult)

      const params: VideoGenerationParams = {
        prompt: 'Test fallback',
        modelId: 'seedance-lite-text',
        duration: 5,
      }

      const result = await falVideoService.generateVideo(params)

      expect(result.status).toBe('completed')
      expect(result.videoUrl).toBeDefined()
      expect(result.thumbnailUrl).toBeDefined()
      expect(mockFal.run).toHaveBeenCalled()
    })

    it('should handle sync generation failure', async () => {
      // Mock queue submission failure
      mockFal.queue.submit.mockRejectedValue(new Error('Queue full'))
      
      // Mock sync generation failure
      mockFal.run.mockRejectedValue(new Error('Generation failed'))

      const params: VideoGenerationParams = {
        prompt: 'Test failure',
        modelId: 'seedance-lite-text',
        duration: 5,
      }

      const result = await falVideoService.generateVideo(params)

      expect(result.status).toBe('failed')
      expect(result.error).toContain('Generation failed')
    })
  })

  describe('Job Status Checking', () => {
    it('should check job status and return processing', async () => {
      const mockStatusResult = {
        status: 'IN_PROGRESS',
        logs: ['Processing video...'],
      }
      mockFal.queue.status.mockResolvedValue(mockStatusResult)

      const result = await falVideoService.getJobStatus('req_test_123')

      expect(result).toEqual({
        id: 'req_test_123',
        status: 'processing',
      })
    })

    it('should check job status and return completed with video', async () => {
      const mockStatusResult = {
        status: 'COMPLETED',
      }
      const mockResultData = {
        data: {
          video: {
            url: 'https://fal.ai/temp/completed-video.mp4',
            width: 1344,
            height: 768,
          },
          image: {
            url: 'https://fal.ai/temp/completed-thumb.jpg',
          },
        },
      }

      mockFal.queue.status.mockResolvedValue(mockStatusResult)
      mockFal.queue.result.mockResolvedValue(mockResultData)

      const result = await falVideoService.getJobStatus('req_test_123')

      expect(result.status).toBe('completed')
      expect(result.videoUrl).toBeDefined()
      expect(result.thumbnailUrl).toBeDefined()
    })

    it('should handle custom job IDs gracefully', async () => {
      const result = await falVideoService.getJobStatus('fal_processing_123')

      expect(result.status).toBe('failed')
      expect(result.error).toContain('Custom job ID')
    })

    it('should handle status check errors', async () => {
      mockFal.queue.status.mockRejectedValue(new Error('API error'))

      const result = await falVideoService.getJobStatus('req_test_123')

      expect(result.status).toBe('failed')
      expect(result.error).toContain('Status check failed')
    })
  })

  describe('Error Handling', () => {
    it('should handle unknown model error', async () => {
      const params: VideoGenerationParams = {
        prompt: 'Test',
        modelId: 'unknown-model',
        duration: 5,
      }

      const result = await falVideoService.generateVideo(params)

      expect(result.status).toBe('failed')
      expect(result.error).toContain('Unknown model')
    })

    it('should handle duration validation', async () => {
      const seedanceModel = falVideoService.getModelConfig('seedance-lite-text')
      if (!seedanceModel) throw new Error('Seedance model not found')

      const params: VideoGenerationParams = {
        prompt: 'Test',
        modelId: 'seedance-lite-text',
        duration: 999, // Exceeds max duration
      }

      const result = await falVideoService.generateVideo(params)

      // Should cap duration at max allowed
      expect(mockFal.queue.submit).toHaveBeenCalledWith(
        expect.any(String),
        {
          input: expect.objectContaining({
            duration: seedanceModel.maxDuration.toString(),
          }),
        }
      )
    })

    it('should handle missing video in response', async () => {
      mockFal.queue.submit.mockRejectedValue(new Error('Queue full'))
      
      const mockSyncResult = {
        request_id: 'sync_req_123',
        // No video property
      }
      mockFal.run.mockResolvedValue(mockSyncResult)

      const params: VideoGenerationParams = {
        prompt: 'Test no video',
        modelId: 'seedance-lite-text',
        duration: 5,
      }

      const result = await falVideoService.generateVideo(params)

      expect(result.status).toBe('failed')
      expect(result.error).toContain('No video generated')
    })
  })

  describe('Utility Methods', () => {
    it('should calculate dimensions correctly', () => {
      const dimensions = falVideoService.getDimensions('16:9')
      expect(dimensions).toEqual({ width: 1344, height: 768 })

      const dimensions2 = falVideoService.getDimensions('9:16')
      expect(dimensions2).toEqual({ width: 768, height: 1344 })
    })

    it('should detect image MIME type', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])
      const mimeType = falVideoService.detectImageMimeType(jpegBuffer)
      expect(mimeType).toBe('image/jpeg')
    })
  })
}) 