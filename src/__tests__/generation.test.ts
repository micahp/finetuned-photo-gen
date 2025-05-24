import { TogetherAIService } from '@/lib/together-ai'
import { prisma } from '@/lib/db'

// Mock fetch for testing
global.fetch = jest.fn()

describe('Image Generation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Clear environment variable for testing
    delete process.env.TOGETHER_API_KEY
  })

  describe('TogetherAIService', () => {
    it('should throw error without API key', () => {
      expect(() => new TogetherAIService()).toThrow('Together AI API key is required')
    })

    it('should initialize with API key', () => {
      const service = new TogetherAIService('test-key')
      expect(service).toBeDefined()
    })

    it('should return available models', () => {
      const service = new TogetherAIService('test-key')
      const models = service.getAvailableModels()
      
      expect(models).toHaveLength(5)
      expect(models[0]).toEqual({
        id: 'black-forest-labs/FLUX.1-schnell-Free',
        name: 'FLUX.1 Schnell (Free)',
        description: 'Fast, free FLUX model - perfect for testing',
        free: true
      })
    })

    it('should return style presets', () => {
      const service = new TogetherAIService('test-key')
      const styles = service.getStylePresets()
      
      expect(styles).toHaveLength(8)
      expect(styles[0]).toEqual({
        id: 'none',
        name: 'None',
        prompt: ''
      })
    })

    it('should return prompt suggestions', () => {
      const service = new TogetherAIService('test-key')
      const suggestions = service.getPromptSuggestions()
      
      expect(suggestions).toHaveLength(10)
      expect(suggestions[0]).toBe('A professional headshot of a person')
    })

    it('should generate image with mock API response', async () => {
      const mockResponse = {
        id: 'test-id',
        data: [{
          url: 'https://example.com/test-image.png'
        }]
      }

      ;(fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      })

      const service = new TogetherAIService('test-key')
      const result = await service.generateImage({
        prompt: 'A test image'
      })

      expect(result.status).toBe('completed')
      expect(result.images).toHaveLength(1)
      expect(result.images![0].url).toBe('https://example.com/test-image.png')
    })

    it('should handle API errors gracefully', async () => {
      ;(fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid request' } })
      })

      const service = new TogetherAIService('test-key')
      const result = await service.generateImage({
        prompt: 'A test image'
      })

      expect(result.status).toBe('failed')
      expect(result.error).toBe('Invalid request')
    })
  })
}) 