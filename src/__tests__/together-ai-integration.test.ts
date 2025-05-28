import { TogetherAIService } from '@/lib/together-ai'
import { TogetherModelService } from '@/lib/together-model-service'
import { TrainingDebugger } from '@/lib/training-debug'

// Mock fetch globally
global.fetch = jest.fn()

describe('Together.ai Integration', () => {
  let togetherService: TogetherAIService
  let togetherModelService: TogetherModelService
  let mockFetch: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    mockFetch = fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockClear()
    
    // Mock environment variables
    process.env.TOGETHER_API_KEY = 'test-api-key'
    process.env.HUGGINGFACE_TOKEN = 'test-hf-token'
    
    togetherService = new TogetherAIService()
    togetherModelService = new TogetherModelService()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('TogetherAIService', () => {
    describe('uploadCustomModel', () => {
      it('should upload model to Together.ai successfully', async () => {
        const mockResponse = {
          data: {
            job_id: 'job-123',
            model_id: 'model-456',
            model_name: 'test-model'
          }
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        } as Response)

        const result = await togetherService.uploadCustomModel({
          modelName: 'test-model',
          modelSource: 'username/test-repo',
          description: 'Test model',
          hfToken: 'test-token'
        })

        expect(result).toEqual({
          jobId: 'job-123',
          modelId: 'model-456',
          modelName: 'test-model',
          status: 'processing'
        })

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.together.xyz/v1/models',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Authorization': 'Bearer test-api-key',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model_name: 'test-model',
              model_source: 'username/test-repo',
              description: 'Test model',
              hf_token: 'test-token'
            })
          })
        )
      })

      it('should handle upload failures', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: { message: 'Invalid model source' } })
        } as Response)

        const result = await togetherService.uploadCustomModel({
          modelName: 'test-model',
          modelSource: 'invalid-source'
        })

        expect(result.status).toBe('failed')
        expect(result.error).toBe('Invalid model source')
      })
    })

    describe('getJobStatus', () => {
      it('should check job status successfully', async () => {
        const mockResponse = {
          job_id: 'job-123',
          type: 'model_upload',
          status: 'Complete',
          status_updates: [
            { status: 'Queued', message: 'Job queued', timestamp: '2023-01-01T00:00:00Z' },
            { status: 'Complete', message: 'Job completed', timestamp: '2023-01-01T01:00:00Z' }
          ]
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        } as Response)

        const result = await togetherService.getJobStatus('job-123')

        expect(result).toEqual({
          jobId: 'job-123',
          type: 'model_upload',
          status: 'Complete',
          statusUpdates: mockResponse.status_updates
        })
      })

      it('should handle failed job status', async () => {
        const mockResponse = {
          job_id: 'job-123',
          type: 'model_upload',
          status: 'Failed',
          status_updates: []
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        } as Response)

        const result = await togetherService.getJobStatus('job-123')

        expect(result.status).toBe('Failed')
        expect(result.error).toBe('Job failed')
      })
    })

    describe('deployModel', () => {
      it('should deploy model successfully', async () => {
        const mockResponse = {
          endpoint_id: 'endpoint-789',
          endpoint_name: 'test-model-endpoint',
          model_id: 'model-456'
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        } as Response)

        const result = await togetherService.deployModel({
          modelId: 'model-456',
          endpointName: 'test-model-endpoint'
        })

        expect(result).toEqual({
          endpointId: 'endpoint-789',
          endpointName: 'test-model-endpoint',
          status: 'deploying',
          modelId: 'model-456'
        })
      })
    })

    describe('generateWithLoRA', () => {
      it('should generate with HuggingFace LoRA', async () => {
        const mockResponse = {
          id: 'img-123',
          data: [{ url: 'https://example.com/image.jpg' }]
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        } as Response)

        const result = await togetherService.generateWithLoRA({
          prompt: 'test prompt',
          loraPath: 'username/test-repo',
          triggerWord: 'test',
          aspectRatio: '1:1'
        })

        expect(result.status).toBe('completed')
        expect(result.images).toHaveLength(1)
        expect(result.images![0].url).toBe('https://example.com/image.jpg')

        // Verify the request was made with HuggingFace URL format
        const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
        expect(requestBody.image_loras[0].path).toBe('huggingface.co/username/test-repo')
      })

      it('should generate with Together.ai custom model', async () => {
        const mockResponse = {
          id: 'img-456',
          data: [{ url: 'https://example.com/image2.jpg' }]
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        } as Response)

        const result = await togetherService.generateWithLoRA({
          prompt: 'test prompt',
          loraPath: 'model-456',
          useTogetherModel: true,
          triggerWord: 'test'
        })

        expect(result.status).toBe('completed')
        
        // Verify the request was made with Together.ai model ID format
        const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
        expect(requestBody.image_loras[0].path).toBe('model-456')
      })

      it('should handle generation errors with helpful messages', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ 
            error: { message: 'HeaderTooLarge: Error while deserializing header' } 
          })
        } as Response)

        const result = await togetherService.generateWithLoRA({
          prompt: 'test prompt',
          loraPath: 'corrupted-model'
        })

        expect(result.status).toBe('failed')
        expect(result.error).toContain('HeaderTooLarge: Error while deserializing header')
      })
    })
  })

  describe('TogetherModelService', () => {
    describe('uploadAndDeployModel', () => {
      it('should complete full workflow successfully', async () => {
        // Mock upload response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              job_id: 'job-123',
              model_id: 'model-456',
              model_name: 'test-model'
            }
          })
        } as Response)

        // Mock job status check (complete)
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            job_id: 'job-123',
            status: 'Complete',
            status_updates: []
          })
        } as Response)

        // Mock deployment response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            endpoint_id: 'endpoint-789',
            endpoint_name: 'test-model-endpoint'
          })
        } as Response)

        const result = await togetherModelService.uploadAndDeployModel({
          modelName: 'test-model',
          huggingfaceRepo: 'username/test-repo',
          autoDeployEndpoint: true
        })

        expect(result.success).toBe(true)
        expect(result.togetherModelId).toBe('model-456')
        expect(result.togetherEndpointId).toBe('endpoint-789')
        expect(result.status).toBe('deploying')
      })

      it('should handle upload failures gracefully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: { message: 'Invalid repository' } })
        } as Response)

        const result = await togetherModelService.uploadAndDeployModel({
          modelName: 'test-model',
          huggingfaceRepo: 'invalid/repo'
        })

        expect(result.success).toBe(false)
        expect(result.status).toBe('failed')
        expect(result.error).toBe('Invalid repository')
      })

      it('should continue without deployment if deployment fails', async () => {
        // Mock successful upload
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              job_id: 'job-123',
              model_id: 'model-456',
              model_name: 'test-model'
            }
          })
        } as Response)

        // Mock job status check (complete)
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            job_id: 'job-123',
            status: 'Complete',
            status_updates: []
          })
        } as Response)

        // Mock deployment failure
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: 'Deployment failed' } })
        } as Response)

        const result = await togetherModelService.uploadAndDeployModel({
          modelName: 'test-model',
          huggingfaceRepo: 'username/test-repo',
          autoDeployEndpoint: true
        })

        expect(result.success).toBe(true) // Upload succeeded
        expect(result.togetherModelId).toBe('model-456')
        expect(result.togetherEndpointId).toBeUndefined()
        expect(result.status).toBe('ready') // Falls back to ready without endpoint
      })
    })

    describe('generateWithCustomModel', () => {
      it('should generate using Together.ai custom model', async () => {
        const mockResponse = {
          id: 'img-789',
          data: [{ url: 'https://example.com/custom-image.jpg' }]
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        } as Response)

        const result = await togetherModelService.generateWithCustomModel({
          prompt: 'custom model test',
          modelId: 'model-456',
          triggerWord: 'custom'
        })

        expect(result.status).toBe('completed')
        expect(result.images![0].url).toBe('https://example.com/custom-image.jpg')

        // Verify it used Together.ai model format
        const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
        expect(requestBody.image_loras[0].path).toBe('model-456')
        expect(requestBody.prompt).toBe('custom, custom model test')
      })
    })
  })

  describe('Integration with TrainingDebugger', () => {
    it('should log debug information during workflow', async () => {
      const trainingDebugger = new TrainingDebugger('test-training-123')
      const serviceWithDebugger = new TogetherModelService(trainingDebugger)

      // Mock successful upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            job_id: 'job-123',
            model_id: 'model-456',
            model_name: 'test-model'
          }
        })
      } as Response)

      // Mock job status check (complete)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          job_id: 'job-123',
          status: 'Complete',
          status_updates: []
        })
      } as Response)

      const result = await serviceWithDebugger.uploadAndDeployModel({
        modelName: 'test-model',
        huggingfaceRepo: 'username/test-repo'
      })

      expect(result.success).toBe(true)
      expect(result.debugData).toBeDefined()
      expect(result.debugData.totalErrors).toBe(0)
    })
  })
}) 