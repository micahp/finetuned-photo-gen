/**
 * @jest-environment node
 */

// Mock NextAuth using the ESM-compatible approach
const mockAuthCustom = jest.fn()
jest.mock('@/lib/next-auth', () => ({
  auth: mockAuthCustom,
}))

// Mock CreditService
const mockSpendCredits = jest.fn()
jest.mock('@/lib/credit-service', () => ({
  CreditService: {
    spendCredits: mockSpendCredits,
  },
}))

// Mock Prisma
const mockPrismaUserFindUnique = jest.fn()
const mockPrismaUserUpdate = jest.fn()
const mockPrismaUserModelFindFirst = jest.fn()
const mockPrismaGeneratedImageCreate = jest.fn()
const mockPrismaTransaction = jest.fn().mockImplementation(async (callback) => {
  // This mock simulates the transaction by simply executing the callback
  // with a mock transaction object (tx).
  // The 'tx' object will have the same methods as the main prisma mock,
  // allowing the code within the transaction to run as expected.
  return callback({
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
    // Add any other models that might be used within a transaction
    processedStripeEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    creditTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'tx-123' }),
    }
  })
})

jest.mock('@/lib/db', () => ({
  prisma: {
    $transaction: mockPrismaTransaction,
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
const mockGetAvailableModelsCustom = jest.fn()
jest.mock('@/lib/together-ai', () => ({
  TogetherAIService: jest.fn().mockImplementation(() => ({
    generateImage: mockGenerateImageCustom,
    generateWithLoRA: mockGenerateWithLoRACustom,
    getStylePresets: mockGetStylePresetsCustom,
    getAvailableModels: mockGetAvailableModelsCustom,
  })),
}))

// Mock ReplicateService
const mockGenerateWithTrainedModelReplicate = jest.fn()
jest.mock('@/lib/replicate-service', () => ({
  ReplicateService: jest.fn().mockImplementation(() => ({
    generateWithTrainedModel: mockGenerateWithTrainedModelReplicate,
  })),
}))

// Mock ImageProcessingService
const mockProcessImageFromUrl = jest.fn()
jest.mock('@/lib/image-processing-service', () => ({
  ImageProcessingService: {
    processImageFromUrl: mockProcessImageFromUrl,
    processBuffer: jest.fn().mockResolvedValue({
      success: true,
      buffer: Buffer.from('mock-image-buffer'),
      width: 1024,
      height: 1024,
      fileSize: 12345,
    }),
    getOptimalOptions: jest.fn().mockReturnValue({
      quality: 85,
      maxFileSize: 10 * 1024 * 1024,
    })
  },
}))

// Mock CloudflareImagesService
const mockUploadImage = jest.fn()
jest.mock('@/lib/cloudflare-images-service', () => ({
  CloudflareImagesService: jest.fn().mockImplementation(() => ({
    uploadImage: mockUploadImage,
    uploadImageFromBuffer: jest.fn().mockResolvedValue({
      success: true,
      imageId: 'cf-image-123',
      url: 'https://imagedelivery.net/123/cf-image-123/public'
    }),
    getPublicUrl: jest.fn().mockReturnValue('https://imagedelivery.net/123/cf-image-123/public'),
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
    
    mockPrismaUserUpdate.mockResolvedValue({
      credits: 9,
    })

    // Default CreditService mock
    mockSpendCredits.mockResolvedValue({
      success: true,
      newBalance: 9
    })
    
    // Default style presets
    mockGetStylePresetsCustom.mockReturnValue([
      { id: 'none', name: 'None', prompt: '' },
      { id: 'photorealistic', name: 'Photorealistic', prompt: 'photorealistic, high quality, detailed' }
    ])
    
    // Default available models (to prevent .find() errors)
    mockGetAvailableModelsCustom.mockReturnValue([
      { id: 'black-forest-labs/FLUX.1-schnell-Free', provider: 'together' },
      { id: 'black-forest-labs/FLUX.1-dev', provider: 'together' }
    ])

    // Default Replicate service mock
    mockGenerateWithTrainedModelReplicate.mockResolvedValue({
      status: 'completed',
      images: [{ url: 'https://example.com/replicate-image.jpg', width: 1024, height: 1024 }]
    })

    // Mock image processing and upload
    mockProcessImageFromUrl.mockResolvedValue({
      success: true,
      buffer: Buffer.from('mock-image-buffer'),
      width: 1024,
      height: 1024,
      fileSize: 1024 * 1024, // 1MB
    })
    
    mockUploadImage.mockResolvedValue({
      success: true,
      imageId: 'cf-image-123',
      url: 'https://imagedelivery.net/123/cf-image-123/public'
    })
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
      
      expect(response.status).toBe(404)
      expect(data.error).toBe('Selected model not found or not ready')
    })

    it('should error when custom model has no replicateModelId', async () => {
      mockPrismaUserModelFindFirst.mockResolvedValue({
        id: 'model-123',
        name: 'test-model',
        status: 'ready',
        loraReadyForInference: true,
        huggingfaceRepo: null,
        replicateModelId: null,
        triggerWord: 'test'
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
      expect(data.error).toBe('Custom model is not available for inference. The model needs to be properly configured with Replicate.')
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
          status: 'ready'
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
      
      // Add this mock to fix the user update issue
      mockPrismaUserUpdate.mockResolvedValue({ credits: 9 })
      
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
      expect(data.image.url).toBe('https://imagedelivery.net/123/cf-image-123/public')
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
      replicateModelId: 'micahp/flux-lora-geo-model-abc123',
      triggerWord: 'geo'
    }

    beforeEach(() => {
      mockPrismaUserModelFindFirst.mockResolvedValue(mockCustomModel)
    })

    it('should generate image with custom LoRA model', async () => {
      mockGenerateWithTrainedModelReplicate.mockResolvedValue({
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
      expect(data.image.url).toBe('https://imagedelivery.net/123/cf-image-123/public')
      expect(data.image.userModel).toEqual({
        id: 'model-123',
        name: 'geo-model',
        triggerWord: 'geo'
      })
      
      expect(mockGenerateWithTrainedModelReplicate).toHaveBeenCalledWith({
        prompt: 'geo, a professional headshot',
        replicateModelId: 'micahp/flux-lora-geo-model-abc123',
        triggerWord: 'geo',
        aspectRatio: '1:1',
        steps: 28,
        seed: undefined
      })
    })

    it('should use default steps for LoRA generation', async () => {
      mockGenerateWithTrainedModelReplicate.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/lora-image.jpg', width: 1024, height: 1024 }]
      })

      mockPrismaGeneratedImageCreate.mockResolvedValue({
        id: 'generated-123',
        createdAt: new Date()
      })

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'a portrait',
          userModelId: 'model-123'
        })
      })
      
      await POST(request)
      
      expect(mockGenerateWithTrainedModelReplicate).toHaveBeenCalledWith({
        prompt: 'geo, a portrait',
        replicateModelId: 'micahp/flux-lora-geo-model-abc123',
        triggerWord: 'geo',
        aspectRatio: '1:1',
        steps: 28, // Default LoRA steps
        seed: undefined
      })
    })

    it('should apply style presets to custom model generation', async () => {
      mockGenerateWithTrainedModelReplicate.mockResolvedValue({
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
      
      expect(mockGenerateWithTrainedModelReplicate).toHaveBeenCalledWith({
        prompt: 'geo, a portrait, photorealistic, high quality, detailed',
        replicateModelId: 'micahp/flux-lora-geo-model-abc123',
        triggerWord: 'geo',
        aspectRatio: '1:1',
        steps: 28,
        seed: undefined
      })
    })

    it('should save generation with custom model metadata', async () => {
      mockGenerateWithTrainedModelReplicate.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/lora-image.jpg', width: 1024, height: 1024 }]
      })

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'a portrait',
          userModelId: 'model-123',
          steps: 30
        })
      })
      
      await POST(request)
      
      expect(mockPrismaGeneratedImageCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            userModelId: 'model-123',
            prompt: 'geo, a portrait',
            imageUrl: 'https://imagedelivery.net/123/cf-image-123/public',
            generationParams: expect.objectContaining({
              steps: 30,
              userModel: expect.objectContaining({
                id: 'model-123',
                name: 'geo-model'
              })
            })
          })
        })
      )
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
        replicateModelId: 'micahp/flux-lora-test-model-xyz789',
        triggerWord: 'test'
      })
      
      mockGenerateWithTrainedModelReplicate.mockResolvedValue({
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
      
      expect(mockSpendCredits).toHaveBeenCalledWith(
        'user-123',
        1,
        expect.stringContaining('Image generation: test prompt'),
        'image_generation',
        undefined,
        expect.objectContaining({
          prompt: 'test prompt',
          model: 'black-forest-labs/FLUX.1-schnell-Free',
          provider: 'together-ai'
        })
      )
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
      
      expect(mockSpendCredits).not.toHaveBeenCalled()
    })

    it('should return updated credit count', async () => {
      // Mock a successful generation
      mockGenerateImageCustom.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/image.jpg' }],
      })
      
      // Initial credits are 10, after spending 1 it should be 9
      mockPrismaUserUpdate.mockResolvedValue({ credits: 9 })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test prompt' }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.creditsRemaining).toBe(9)
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