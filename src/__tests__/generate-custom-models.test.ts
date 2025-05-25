/**
 * @jest-environment node
 */

// Mock NextAuth using the ESM-compatible approach
const mockAuthCustom = jest.fn()
jest.mock('@/lib/next-auth', () => ({
  auth: mockAuthCustom,
}))

// Mock Prisma
const mockPrismaUserFindUnique = jest.fn()
const mockPrismaUserUpdate = jest.fn()
const mockPrismaUserModelFindFirst = jest.fn()
const mockPrismaGeneratedImageCreate = jest.fn()
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: mockPrismaUserFindUnique,
      update: mockPrismaUserUpdate,
    },
    userModel: {
      findFirst: mockPrismaUserModelFindFirst,
    },
    generatedImage: {
      create: mockPrismaGeneratedImageCreate,
    },
  },
}))

// Mock TogetherAI service
const mockGenerateImageCustom = jest.fn()
const mockGenerateWithLoRACustom = jest.fn()
const mockGetStylePresetsCustom = jest.fn()
jest.mock('@/lib/together-ai', () => ({
  TogetherAIService: jest.fn().mockImplementation(() => ({
    generateImage: mockGenerateImageCustom,
    generateWithLoRA: mockGenerateWithLoRACustom,
    getStylePresets: mockGetStylePresetsCustom,
  })),
}))

describe('Custom Model Generation API', () => {
  // Import the handler after mocks are set up
  let POST: any
  
  beforeAll(async () => {
    // Dynamic import to ensure mocks are applied first
    const module = await import('@/app/api/generate/route')
    POST = module.POST
  })

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default auth mock - properly typed
    mockAuthCustom.mockResolvedValue({
      user: { 
        id: 'user-123', 
        email: 'test@example.com',
        name: 'Test User',
        subscriptionStatus: 'active',
        subscriptionPlan: null,
        stripeCustomerId: null,
        credits: 10
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    })
    
    // Default user with credits
    mockPrismaUserFindUnique.mockResolvedValue({
      credits: 10
    })
    
    // Default style presets
    mockGetStylePresetsCustom.mockReturnValue([
      { id: 'none', name: 'None', prompt: '' },
      { id: 'photorealistic', name: 'Photorealistic', prompt: 'photorealistic, high quality, detailed' }
    ])
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      mockAuthCustom.mockResolvedValue(null)
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'test prompt',
          userModelId: 'model-123'
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })

    it('should require sufficient credits', async () => {
      mockPrismaUserFindUnique.mockResolvedValue({ credits: 0 })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'test prompt',
          userModelId: 'model-123'
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Insufficient credits')
    })
  })

  describe('Custom Model Validation', () => {
    it('should validate custom model exists and is ready', async () => {
      mockPrismaUserModelFindFirst.mockResolvedValue(null)
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'test prompt',
          userModelId: 'non-existent-model'
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Custom model not found, not ready, or not available for inference')
    })

    it('should validate custom model has HuggingFace repository', async () => {
      mockPrismaUserModelFindFirst.mockResolvedValue({
        id: 'model-123',
        name: 'test-model',
        status: 'ready',
        loraReadyForInference: true,
        huggingfaceRepo: null
      })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'test prompt',
          userModelId: 'model-123'
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Custom model does not have a HuggingFace repository configured')
    })

    it('should only allow user to access their own models', async () => {
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'test prompt',
          userModelId: 'model-123'
        })
      })
      
      await POST(request)
      
      expect(mockPrismaUserModelFindFirst).toHaveBeenCalledWith({
        where: {
          id: 'model-123',
          userId: 'user-123',
          status: 'ready',
          loraReadyForInference: true,
          huggingfaceRepo: { not: null }
        }
      })
    })
  })

  describe('Base Model Generation', () => {
    it('should generate image with base model when no custom model specified', async () => {
      mockGenerateImageCustom.mockResolvedValue({
        status: 'completed',
        images: [{
          url: 'https://example.com/image.jpg',
          width: 1024,
          height: 1024
        }]
      })
      
      mockPrismaGeneratedImageCreate.mockResolvedValue({
        id: 'generated-123',
        createdAt: new Date()
      })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'a beautiful landscape',
          modelId: 'black-forest-labs/FLUX.1-schnell-Free',
          aspectRatio: '1:1',
          steps: 4
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.image.url).toBe('https://example.com/image.jpg')
      expect(mockGenerateImageCustom).toHaveBeenCalledWith({
        prompt: 'a beautiful landscape',
        model: 'black-forest-labs/FLUX.1-schnell-Free',
        aspectRatio: '1:1',
        steps: 4,
        seed: undefined
      })
    })

    it('should apply style presets to base model generation', async () => {
      mockGenerateImageCustom.mockResolvedValue({
        status: 'completed',
        images: [{
          url: 'https://example.com/image.jpg',
          width: 1024,
          height: 1024
        }]
      })
      
      mockPrismaGeneratedImageCreate.mockResolvedValue({
        id: 'generated-123',
        createdAt: new Date()
      })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'a portrait',
          style: 'photorealistic',
          aspectRatio: '1:1'
        })
      })
      
      const response = await POST(request)
      
      expect(mockGenerateImageCustom).toHaveBeenCalledWith({
        prompt: 'a portrait, photorealistic, high quality, detailed',
        model: undefined,
        aspectRatio: '1:1',
        steps: undefined,
        seed: undefined
      })
    })
  })

  describe('Custom Model LoRA Generation', () => {
    const mockCustomModel = {
      id: 'model-123',
      name: 'geo-model',
      status: 'ready',
      loraReadyForInference: true,
      huggingfaceRepo: 'geoppls/geo-1748133826702-np1tbn',
      triggerWord: 'geo'
    }

    beforeEach(() => {
      mockPrismaUserModelFindFirst.mockResolvedValue(mockCustomModel)
    })

    it('should generate image with custom LoRA model', async () => {
      mockGenerateWithLoRACustom.mockResolvedValue({
        status: 'completed',
        images: [{
          url: 'https://example.com/lora-image.jpg',
          width: 1024,
          height: 1024
        }]
      })
      
      mockPrismaGeneratedImageCreate.mockResolvedValue({
        id: 'generated-123',
        createdAt: new Date()
      })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'a professional headshot',
          userModelId: 'model-123',
          aspectRatio: '1:1',
          steps: 28
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.image.url).toBe('https://example.com/lora-image.jpg')
      expect(data.image.userModel).toEqual({
        id: 'model-123',
        name: 'geo-model',
        triggerWord: 'geo'
      })
      
      expect(mockGenerateWithLoRACustom).toHaveBeenCalledWith({
        prompt: 'a professional headshot',
        loraPath: 'geoppls/geo-1748133826702-np1tbn',
        triggerWord: 'geo',
        aspectRatio: '1:1',
        steps: 28,
        seed: undefined
      })
    })

    it('should use default steps for LoRA generation', async () => {
      mockGenerateWithLoRACustom.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/image.jpg', width: 1024, height: 1024 }]
      })
      
      mockPrismaGeneratedImageCreate.mockResolvedValue({
        id: 'generated-123',
        createdAt: new Date()
      })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'a portrait',
          userModelId: 'model-123'
        })
      })
      
      await POST(request)
      
      expect(mockGenerateWithLoRACustom).toHaveBeenCalledWith({
        prompt: 'a portrait',
        loraPath: 'geoppls/geo-1748133826702-np1tbn',
        triggerWord: 'geo',
        aspectRatio: '1:1',
        steps: 28, // Default for LoRA
        seed: undefined
      })
    })

    it('should apply style presets to custom model generation', async () => {
      mockGenerateWithLoRACustom.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/image.jpg', width: 1024, height: 1024 }]
      })
      
      mockPrismaGeneratedImageCreate.mockResolvedValue({
        id: 'generated-123',
        createdAt: new Date()
      })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'a portrait',
          userModelId: 'model-123',
          style: 'photorealistic'
        })
      })
      
      await POST(request)
      
      expect(mockGenerateWithLoRACustom).toHaveBeenCalledWith({
        prompt: 'a portrait, photorealistic, high quality, detailed',
        loraPath: 'geoppls/geo-1748133826702-np1tbn',
        triggerWord: 'geo',
        aspectRatio: '1:1',
        steps: 28,
        seed: undefined
      })
    })

    it('should save generation with custom model metadata', async () => {
      mockGenerateWithLoRACustom.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/image.jpg', width: 1024, height: 1024 }]
      })
      
      mockPrismaGeneratedImageCreate.mockResolvedValue({
        id: 'generated-123',
        createdAt: new Date()
      })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'a portrait',
          userModelId: 'model-123',
          steps: 30
        })
      })
      
      await POST(request)
      
      expect(mockPrismaGeneratedImageCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          userModelId: 'model-123',
          prompt: 'a portrait',
          imageUrl: 'https://example.com/image.jpg',
          generationParams: {
            model: 'black-forest-labs/FLUX.1-dev-lora',
            aspectRatio: '1:1',
            steps: 30,
            seed: undefined,
            style: undefined,
            userModel: {
              id: 'model-123',
              name: 'geo-model',
              huggingfaceRepo: 'geoppls/geo-1748133826702-np1tbn',
              triggerWord: 'geo'
            }
          },
          creditsUsed: 1
        }
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle Together.AI generation failures', async () => {
      mockGenerateImageCustom.mockResolvedValue({
        status: 'failed',
        error: 'API rate limit exceeded'
      })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'test prompt'
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.error).toBe('API rate limit exceeded')
    })

    it('should handle LoRA generation failures', async () => {
      mockPrismaUserModelFindFirst.mockResolvedValue({
        id: 'model-123',
        name: 'test-model',
        status: 'ready',
        loraReadyForInference: true,
        huggingfaceRepo: 'test/repo',
        triggerWord: 'test'
      })
      
      mockGenerateWithLoRACustom.mockResolvedValue({
        status: 'failed',
        error: 'LoRA model not found'
      })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'test prompt',
          userModelId: 'model-123'
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.error).toBe('LoRA model not found')
    })

    it('should handle database errors gracefully', async () => {
      mockPrismaUserFindUnique.mockRejectedValue(new Error('Database connection failed'))
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'test prompt'
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('Credit Management', () => {
    it('should deduct credits only on successful generation', async () => {
      mockGenerateImageCustom.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/image.jpg', width: 1024, height: 1024 }]
      })
      
      mockPrismaGeneratedImageCreate.mockResolvedValue({
        id: 'generated-123',
        createdAt: new Date()
      })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'test prompt'
        })
      })
      
      await POST(request)
      
      expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { credits: { decrement: 1 } }
      })
    })

    it('should not deduct credits on generation failure', async () => {
      mockGenerateImageCustom.mockResolvedValue({
        status: 'failed',
        error: 'Generation failed'
      })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'test prompt'
        })
      })
      
      await POST(request)
      
      expect(mockPrismaUserUpdate).not.toHaveBeenCalled()
    })

    it('should return updated credit count', async () => {
      mockPrismaUserFindUnique.mockResolvedValue({ credits: 5 })
      mockGenerateImageCustom.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/image.jpg', width: 1024, height: 1024 }]
      })
      
      mockPrismaGeneratedImageCreate.mockResolvedValue({
        id: 'generated-123',
        createdAt: new Date()
      })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'test prompt'
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(data.creditsRemaining).toBe(4) // 5 - 1
    })
  })

  describe('Input Validation', () => {
    it('should validate required prompt', async () => {
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: ''
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toContain('Prompt is required')
    })

    it('should validate prompt length', async () => {
      const longPrompt = 'a'.repeat(501)
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: longPrompt
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toContain('Prompt too long')
    })

    it('should validate aspect ratio', async () => {
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'test prompt',
          aspectRatio: 'invalid'
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toContain('Validation failed')
    })

    it('should validate steps range', async () => {
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'test prompt',
          steps: 100
        })
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toContain('Validation failed')
    })
  })
}) 