import { TogetherAIService } from '@/lib/together-ai'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('TogetherAIService', () => {
  let service: TogetherAIService
  
  beforeEach(() => {
    jest.clearAllMocks()
    // Initialize with a test API key
    service = new TogetherAIService('test-api-key')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with provided API key', () => {
      const testService = new TogetherAIService('custom-key')
      expect(testService).toBeInstanceOf(TogetherAIService)
    })

    it('should use environment variable if no API key provided', () => {
      process.env.TOGETHER_API_KEY = 'env-key'
      const testService = new TogetherAIService()
      expect(testService).toBeInstanceOf(TogetherAIService)
    })

    it('should throw error if no API key available', () => {
      delete process.env.TOGETHER_API_KEY
      expect(() => new TogetherAIService()).toThrow('Together AI API key is required')
    })
  })

  describe('generateImage', () => {
    it('should generate image with basic parameters', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          id: 'test-id',
          data: [{
            url: 'https://example.com/image.jpg'
          }]
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await service.generateImage({
        prompt: 'a beautiful landscape',
        aspectRatio: '1:1'
      })

      expect(result.status).toBe('completed')
      expect(result.images).toHaveLength(1)
      expect(result.images![0].url).toBe('https://example.com/image.jpg')
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.together.xyz/v1/images/generations',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('"prompt":"a beautiful landscape"')
        })
      )
    })

    it('should use LoRA model when imageLoras provided', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          id: 'test-id',
          data: [{
            url: 'https://example.com/lora-image.jpg'
          }]
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await service.generateImage({
        prompt: 'a portrait',
        imageLoras: [{
          path: 'geoppls/geo-1748133826702-np1tbn',
          scale: 1.0
        }]
      })

      expect(result.status).toBe('completed')
      
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody.model).toBe('black-forest-labs/FLUX.1-dev-lora')
      expect(requestBody.steps).toBe(28) // Higher steps for LoRA
      expect(requestBody.image_loras).toEqual([{
        path: 'geoppls/geo-1748133826702-np1tbn',
        scale: 1.0
      }])
    })

    it('should handle API errors gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        json: async () => ({
          error: { message: 'Rate limit exceeded' }
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await service.generateImage({
        prompt: 'test prompt'
      })

      expect(result.status).toBe('failed')
      expect(result.error).toBe('Rate limit exceeded')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await service.generateImage({
        prompt: 'test prompt'
      })

      expect(result.status).toBe('failed')
      expect(result.error).toBe('Network error')
    })

    it('should use correct dimensions for aspect ratios', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          id: 'test-id',
          data: [{ url: 'https://example.com/image.jpg' }]
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      await service.generateImage({
        prompt: 'test',
        aspectRatio: '16:9'
      })

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody.width).toBe(1344)
      expect(requestBody.height).toBe(768)
    })
  })

  describe('generateWithLoRA', () => {
    it('should generate image with LoRA parameters', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          id: 'test-id',
          data: [{
            url: 'https://example.com/lora-image.jpg'
          }]
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await service.generateWithLoRA({
        prompt: 'a professional headshot',
        loraPath: 'geoppls/geo-1748133826702-np1tbn',
        triggerWord: 'geo',
        aspectRatio: '1:1',
        steps: 30
      })

      expect(result.status).toBe('completed')
      expect(result.images![0].url).toBe('https://example.com/lora-image.jpg')
      
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody.prompt).toBe('geo a professional headshot')
      expect(requestBody.model).toBe('black-forest-labs/FLUX.1-dev-lora')
      expect(requestBody.steps).toBe(30)
      expect(requestBody.image_loras).toEqual([{
        path: 'https://huggingface.co/geoppls/geo-1748133826702-np1tbn',
        scale: 1.0
      }])
    })

    it('should use default steps for LoRA when not specified', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          id: 'test-id',
          data: [{ url: 'https://example.com/image.jpg' }]
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      await service.generateWithLoRA({
        prompt: 'test',
        loraPath: 'test/repo'
      })

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody.steps).toBe(28) // Default for LoRA
    })

    it('should handle missing trigger word', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          id: 'test-id',
          data: [{ url: 'https://example.com/image.jpg' }]
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      await service.generateWithLoRA({
        prompt: 'a portrait',
        loraPath: 'test/repo'
      })

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody.prompt).toBe('a portrait') // No trigger word prepended
    })

    it('should apply custom LoRA scale', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          id: 'test-id',
          data: [{ url: 'https://example.com/image.jpg' }]
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      await service.generateWithLoRA({
        prompt: 'test',
        loraPath: 'test/repo',
        loraScale: 0.8
      })

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(requestBody.image_loras[0].scale).toBe(0.8)
    })
  })

  describe('getAvailableModels', () => {
    it('should return list of available FLUX models', () => {
      const models = service.getAvailableModels()
      
      expect(models).toBeInstanceOf(Array)
      expect(models.length).toBeGreaterThan(0)
      
      const freeModel = models.find(m => m.free)
      expect(freeModel).toBeDefined()
      expect(freeModel!.id).toBe('black-forest-labs/FLUX.1-schnell-Free')
      
      const devModel = models.find(m => m.id === 'black-forest-labs/FLUX.1-dev')
      expect(devModel).toBeDefined()
      expect(devModel!.name).toBe('FLUX.1 Dev')
    })
  })

  describe('getStylePresets', () => {
    it('should return list of style presets', () => {
      const styles = service.getStylePresets()
      
      expect(styles).toBeInstanceOf(Array)
      expect(styles.length).toBeGreaterThan(0)
      
      const noneStyle = styles.find(s => s.id === 'none')
      expect(noneStyle).toBeDefined()
      expect(noneStyle!.prompt).toBe('')
      
      const photoStyle = styles.find(s => s.id === 'photorealistic')
      expect(photoStyle).toBeDefined()
      expect(photoStyle!.prompt).toContain('photorealistic')
    })
  })

  describe('getQuickPrompts', () => {
    it('should return list of quick prompt templates', () => {
      const prompts = service.getQuickPrompts()
      
      expect(prompts).toBeInstanceOf(Array)
      expect(prompts.length).toBeGreaterThan(0)
      
      const professionalPrompt = prompts.find(p => p.label === 'Professional Headshot')
      expect(professionalPrompt).toBeDefined()
      expect(professionalPrompt!.emoji).toBe('💼')
      expect(professionalPrompt!.prompt).toContain('Professional business headshot')
    })
  })

  describe('getCategorizedPrompts', () => {
    it('should return categorized prompt suggestions', () => {
      const categories = service.getCategorizedPrompts()
      
      expect(categories).toBeInstanceOf(Object)
      expect(categories['Dating Apps']).toBeDefined()
      expect(categories['Professional Headshots']).toBeDefined()
      
      const datingPrompts = categories['Dating Apps']
      expect(datingPrompts).toBeInstanceOf(Array)
      expect(datingPrompts.length).toBeGreaterThan(0)
      expect(datingPrompts[0]).toHaveProperty('prompt')
      expect(datingPrompts[0]).toHaveProperty('description')
    })
  })

  describe('batchGenerateImages', () => {
    it('should process multiple prompts in batches', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          id: 'test-id',
          data: [{ url: 'https://example.com/image.jpg' }]
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await service.batchGenerateImages({
        prompts: ['prompt 1', 'prompt 2', 'prompt 3'],
        batchSize: 2
      })

      expect(result.status).toBe('completed')
      expect(result.totalCount).toBe(3)
      expect(result.completedCount).toBe(3)
      expect(result.results).toHaveLength(3)
      
      // Should have made 2 batches (2 + 1)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should handle partial failures in batch processing', async () => {
      let callCount = 0
      mockFetch.mockImplementation(() => {
        callCount++
        if (callCount === 2) {
          // Second call fails
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ error: { message: 'Server error' } })
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 'test-id',
            data: [{ url: 'https://example.com/image.jpg' }]
          })
        })
      })

      const result = await service.batchGenerateImages({
        prompts: ['prompt 1', 'prompt 2', 'prompt 3']
      })

      expect(result.status).toBe('completed')
      expect(result.totalCount).toBe(3)
      expect(result.completedCount).toBe(2) // 2 successful, 1 failed
      
      const failedResult = result.results.find(r => r.error)
      expect(failedResult).toBeDefined()
      expect(failedResult!.error).toContain('Server error')
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON responses', async () => {
      const mockResponse = {
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        }
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await service.generateImage({
        prompt: 'test prompt'
      })

      expect(result.status).toBe('failed')
      expect(result.error).toContain('Invalid JSON')
    })

    it('should handle missing response data', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          id: 'test-id'
          // Missing data array
        })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await service.generateImage({
        prompt: 'test prompt'
      })

      expect(result.status).toBe('failed')
      expect(result.error).toBeDefined()
    })
  })
}) 