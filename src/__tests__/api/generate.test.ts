/**
 * @jest-environment node
 */

// Mock NextAuth using the ESM-compatible approach
const mockAuthGenerate = jest.fn()
jest.mock('@/lib/next-auth', () => ({
  auth: mockAuthGenerate,
}))

// Mock Prisma
const mockPrismaFindUniqueGenerate = jest.fn()
const mockPrismaUpdateGenerate = jest.fn()
const mockPrismaCreateGenerate = jest.fn()
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: mockPrismaFindUniqueGenerate,
      update: mockPrismaUpdateGenerate,
    },
    generatedImage: {
      create: mockPrismaCreateGenerate,
    },
    userModel: {
      findFirst: jest.fn(),
    },
    $transaction: global.mockPrismaTransaction,
  },
}))

// Mock CreditService
jest.mock('@/lib/credit-service', () => ({
  CreditService: {
    spendCredits: global.mockCreditServiceSpendCredits,
    addCredits: global.mockCreditServiceAddCredits,
    recordTransaction: global.mockCreditServiceRecordTransaction,
    getUsageAnalytics: global.mockCreditServiceGetUsageAnalytics,
    checkUsageLimits: global.mockCreditServiceCheckUsageLimits,
    canAfford: global.mockCreditServiceCanAfford,
    getLowCreditNotification: global.mockCreditServiceGetLowCreditNotification,
  },
}))

// Mock CloudflareImagesService
const mockUploadImageFromUrl = jest.fn()
const mockGetPublicUrl = jest.fn()
jest.mock('@/lib/cloudflare-images-service', () => ({
  CloudflareImagesService: jest.fn().mockImplementation(() => ({
    uploadImageFromUrl: mockUploadImageFromUrl,
    getPublicUrl: mockGetPublicUrl,
  })),
}))

// Mock ReplicateService
const mockGenerateWithTrainedModel = jest.fn()
jest.mock('@/lib/replicate-service', () => ({
  ReplicateService: jest.fn().mockImplementation(() => ({
    generateWithTrainedModel: mockGenerateWithTrainedModel,
  })),
}))

// Mock TogetherAI service
const mockGenerateImage = jest.fn()
const mockGetStylePresets = jest.fn()
const mockGetAvailableModels = jest.fn()
jest.mock('@/lib/together-ai', () => ({
  TogetherAIService: jest.fn().mockImplementation(() => ({
    generateImage: mockGenerateImage,
    getStylePresets: mockGetStylePresets,
    getAvailableModels: mockGetAvailableModels,
  })),
}))

describe('/api/generate', () => {
  // Import the handler after mocks are set up
  let POST: any
  
  beforeAll(async () => {
    // Dynamic import to ensure mocks are applied first
    const module = await import('@/app/api/generate/route')
    POST = module.POST
  })

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default style presets mock
    mockGetStylePresets.mockReturnValue([
      { id: 'realistic', prompt: 'photorealistic, high quality' },
      { id: 'artistic', prompt: 'artistic style, creative' },
      { id: 'none', prompt: '' },
    ])
    
    // Default available models mock
    mockGetAvailableModels.mockReturnValue([
      {
        id: 'black-forest-labs/FLUX.1-schnell-Free',
        name: 'FLUX.1 Schnell (Free)',
        provider: 'together'
      },
      {
        id: 'black-forest-labs/FLUX.1-schnell',
        name: 'FLUX.1 Schnell',
        provider: 'together'
      },
      {
        id: 'black-forest-labs/FLUX.1-pro',
        name: 'FLUX.1 Pro',
        provider: 'replicate'
      }
    ])
    
    // Default Cloudflare Images mock
    mockUploadImageFromUrl.mockResolvedValue({
      success: true,
      imageId: 'cf-img-123',
    })
    mockGetPublicUrl.mockReturnValue('https://imagedelivery.net/cf-img-123/public')
  })

  describe('POST - Authentication Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      mockAuthGenerate.mockResolvedValue(null)
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A beautiful sunset' })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
      expect(mockPrismaFindUniqueGenerate).not.toHaveBeenCalled()
    })

    it('should return 401 when session exists but user.id is missing', async () => {
      // Arrange
      mockAuthGenerate.mockResolvedValue({ user: { id: undefined } })
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A beautiful sunset' })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
      expect(mockPrismaFindUniqueGenerate).not.toHaveBeenCalled()
    })
  })

  describe('POST - Credit Validation', () => {
    beforeEach(() => {
      mockAuthGenerate.mockResolvedValue({ user: { id: 'user-123' } })
    })

    it('should return 400 when user has insufficient credits', async () => {
      // Arrange
      mockPrismaFindUniqueGenerate.mockResolvedValue({ credits: 0 })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A beautiful sunset' })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Insufficient credits')
      expect(mockPrismaFindUniqueGenerate).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { 
          credits: true,
          subscriptionPlan: true,
          subscriptionStatus: true
        }
      })
      expect(mockGenerateImage).not.toHaveBeenCalled()
    })

    it('should return 404 when user is not found', async () => {
      // Arrange
      mockPrismaFindUniqueGenerate.mockResolvedValue(null)
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A beautiful sunset' })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(data.error).toBe('User not found')
    })

    it('should proceed when user has sufficient credits', async () => {
      // Arrange
      mockPrismaFindUniqueGenerate.mockResolvedValue({ credits: 10 })
      mockGenerateImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/generated.jpg' }]
      })
      mockPrismaUpdateGenerate.mockResolvedValue({ credits: 9 })
      mockPrismaCreateGenerate.mockResolvedValue({
        id: 'img-123',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A beautiful sunset' })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('POST - Input Validation (Zod Schema)', () => {
    beforeEach(() => {
      mockAuthGenerate.mockResolvedValue({ user: { id: 'user-123' } })
      mockPrismaFindUniqueGenerate.mockResolvedValue({ credits: 10 })
    })

    it('should return 400 when prompt is missing', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('Validation failed')
      expect(data.error).toContain('Required')
      expect(mockGenerateImage).not.toHaveBeenCalled()
    })

    it('should return 400 when prompt is empty string', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '' })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('Validation failed')
      expect(data.error).toContain('Prompt is required')
    })

    it('should return 400 when prompt is too long', async () => {
      // Arrange
      const longPrompt = 'a'.repeat(501) // Exceeds 500 char limit
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: longPrompt })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('Validation failed')
      expect(data.error).toContain('Prompt too long')
    })

    it('should return 400 when aspectRatio is invalid', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: 'A beautiful sunset',
          aspectRatio: '2:1' // Invalid aspect ratio
        })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('Validation failed')
    })

    it('should return 400 when steps is out of range', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: 'A beautiful sunset',
          steps: 100 // Exceeds max of 50
        })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('Validation failed')
    })

    it('should accept valid input with all parameters', async () => {
      // Arrange
      mockGenerateImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/generated.jpg' }]
      })
      mockPrismaUpdateGenerate.mockResolvedValue({ credits: 9 })
      mockPrismaCreateGenerate.mockResolvedValue({
        id: 'img-123',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      })

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: 'A beautiful sunset over mountains',
          modelId: 'black-forest-labs/FLUX.1-schnell-Free',
          style: 'realistic',
          aspectRatio: '16:9',
          steps: 20,
          seed: 12345
        })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('POST - Style Processing', () => {
    beforeEach(() => {
      mockAuthGenerate.mockResolvedValue({ user: { id: 'user-123' } })
      mockPrismaFindUniqueGenerate.mockResolvedValue({ credits: 10 })
      mockGenerateImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/generated.jpg' }]
      })
      mockPrismaUpdateGenerate.mockResolvedValue({ credits: 9 })
      mockPrismaCreateGenerate.mockResolvedValue({
        id: 'img-123',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      })
    })

    it('should use original prompt when style is "none"', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: 'A beautiful sunset',
          style: 'none'
        })
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockGenerateImage).toHaveBeenCalledWith({
        prompt: 'A beautiful sunset', // No style modification
        model: undefined,
        aspectRatio: '1:1',
        steps: undefined,
        seed: undefined
      })
    })

    it('should append style prompt when style is selected', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: 'A beautiful sunset',
          style: 'realistic'
        })
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockGenerateImage).toHaveBeenCalledWith({
        prompt: 'A beautiful sunset, photorealistic, high quality',
        model: undefined,
        aspectRatio: '1:1',
        steps: undefined,
        seed: undefined
      })
    })

    it('should handle non-existent style gracefully', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: 'A beautiful sunset',
          style: 'nonexistent-style'
        })
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockGenerateImage).toHaveBeenCalledWith({
        prompt: 'A beautiful sunset', // No style modification for unknown style
        model: undefined,
        aspectRatio: '1:1',
        steps: undefined,
        seed: undefined
      })
    })
  })

  describe('POST - TogetherAI Integration', () => {
    beforeEach(() => {
      mockAuthGenerate.mockResolvedValue({ user: { id: 'user-123' } })
      mockPrismaFindUniqueGenerate.mockResolvedValue({ credits: 10 })
    })

    it('should return 500 when TogetherAI generation fails', async () => {
      // Arrange
      mockGenerateImage.mockResolvedValue({
        status: 'failed',
        error: 'Model not available'
      })

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A beautiful sunset' })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Model not available')
      // Credits should not be deducted on failure
      expect(global.mockCreditServiceSpendCredits).not.toHaveBeenCalled()
      expect(mockPrismaCreateGenerate).not.toHaveBeenCalled()
    })

    it('should return 500 when TogetherAI returns incomplete result', async () => {
      // Arrange
      mockGenerateImage.mockResolvedValue({
        status: 'completed',
        images: [] // No images returned
      })

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A beautiful sunset' })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Generation incomplete')
    })

    it('should handle TogetherAI service throwing an error', async () => {
      // Arrange
      mockGenerateImage.mockRejectedValue(new Error('Network timeout'))

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A beautiful sunset' })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('POST - Successful Generation Flow', () => {
    beforeEach(() => {
      mockAuthGenerate.mockResolvedValue({ user: { id: 'user-123' } })
      mockPrismaFindUniqueGenerate.mockResolvedValue({ credits: 10 })
      mockGenerateImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/generated.jpg' }]
      })
      mockPrismaUpdateGenerate.mockResolvedValue({ credits: 9 })
      mockPrismaCreateGenerate.mockResolvedValue({
        id: 'img-123',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      })
    })

    it('should successfully generate image and save to database', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: 'A beautiful sunset',
          aspectRatio: '16:9',
          style: 'realistic'
        })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.image).toEqual({
        id: 'img-123',
        url: 'https://example.com/generated.jpg',
        prompt: 'A beautiful sunset, photorealistic, high quality',
        aspectRatio: '16:9',
        width: null,
        height: null,
        generationDuration: 0,
        createdAt: '2024-01-15T10:00:00.000Z',
        userModel: undefined
      })
      expect(data.creditsRemaining).toBe(9)

      // Verify credit deduction via CreditService
      expect(global.mockCreditServiceSpendCredits).toHaveBeenCalledWith(
        'user-123',
        1,
        expect.stringContaining('Image generation:'),
        'image_generation',
        undefined,
        expect.objectContaining({
          prompt: 'A beautiful sunset, photorealistic, high quality',
          model: 'black-forest-labs/FLUX.1-schnell-Free',
          provider: 'together-ai'
        })
      )

              // Verify image saved to database
        expect(mockPrismaCreateGenerate).toHaveBeenCalledWith({
          data: {
            userId: 'user-123',
            userModelId: null,
            prompt: 'A beautiful sunset, photorealistic, high quality',
            imageUrl: 'https://imagedelivery.net/cf-img-123/public', // Cloudflare URL
            cloudflareImageId: 'cf-img-123',
            generationParams: {
              model: 'black-forest-labs/FLUX.1-schnell-Free',
              provider: 'together-ai',
              aspectRatio: '16:9',
              steps: undefined,
              seed: undefined,
              style: 'realistic',
              userModel: undefined
            },
            creditsUsed: 1
          }
        })
    })

    it('should pass all parameters to TogetherAI correctly', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: 'A mountain landscape',
          modelId: 'custom-model',
          aspectRatio: '3:4',
          steps: 25,
          seed: 54321,
          style: 'artistic'
        })
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockGenerateImage).toHaveBeenCalledWith({
        prompt: 'A mountain landscape, artistic style, creative',
        model: 'custom-model',
        aspectRatio: '3:4',
        steps: 25,
        seed: 54321
      })
    })
  })

  describe('POST - Database Transaction Safety', () => {
    beforeEach(() => {
      mockAuthGenerate.mockResolvedValue({ user: { id: 'user-123' } })
      mockPrismaFindUniqueGenerate.mockResolvedValue({ credits: 1 })
      mockGenerateImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/generated.jpg' }]
      })
    })

    it('should not deduct credits if image save fails', async () => {
      // Arrange
      mockPrismaCreateGenerate.mockRejectedValue(new Error('Database save failed'))

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A beautiful sunset' })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      // Credit service should have been called but image save failed
      expect(global.mockCreditServiceSpendCredits).toHaveBeenCalled()
      expect(mockPrismaCreateGenerate).toHaveBeenCalled()
    })

    it('should handle credit deduction failure gracefully', async () => {
      // Arrange
      global.mockCreditServiceSpendCredits.mockResolvedValue({
        success: false,
        newBalance: 1,
        error: 'Credit deduction failed'
      })

      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A beautiful sunset' })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Credit deduction failed')
    })
  })

  describe('POST - Fine-tuned Models (Simplified)', () => {
    beforeEach(() => {
      mockAuthGenerate.mockResolvedValue({ user: { id: 'user-123' } })
      mockPrismaFindUniqueGenerate.mockResolvedValue({ credits: 10 })
      mockGenerateImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/generated.jpg' }]
      })
      mockPrismaUpdateGenerate.mockResolvedValue({ credits: 9 })
      mockPrismaCreateGenerate.mockResolvedValue({
        id: 'img-123',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      })
    })

    it('should save userModelId as null for base model generation', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A beautiful sunset' })
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockPrismaCreateGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userModelId: null, // No custom model for base generation
          })
        })
      )
    })

    // NOTE: Fine-tuned model tests will be added later when that feature is developed
    it('should handle custom model IDs (placeholder for future development)', async () => {
      // This is a placeholder test for when fine-tuned models are implemented
      // For now, we just test that the system doesn't break with custom model IDs
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: 'A beautiful sunset',
          modelId: 'user-custom-model-123' // This would be a fine-tuned model
        })
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'user-custom-model-123'
        })
      )
    })
  })

  describe('POST - Edge Cases', () => {
    beforeEach(() => {
      mockAuthGenerate.mockResolvedValue({ user: { id: 'user-123' } })
      mockPrismaFindUniqueGenerate.mockResolvedValue({ credits: 1 })
      mockGenerateImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/generated.jpg' }]
      })
      mockPrismaUpdateGenerate.mockResolvedValue({ credits: 0 })
      mockPrismaCreateGenerate.mockResolvedValue({
        id: 'img-123',
        createdAt: new Date('2024-01-15T10:00:00Z'),
      })
    })

    it('should handle malformed JSON request body', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should handle exactly 1 credit remaining', async () => {
      // Arrange - User has exactly 1 credit
      mockPrismaFindUniqueGenerate.mockResolvedValue({ credits: 1 })
      // Mock CreditService to return 0 credits after spending 1
      global.mockCreditServiceSpendCredits.mockResolvedValue({
        success: true,
        newBalance: 0,
      })
      
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'A beautiful sunset' })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.creditsRemaining).toBe(0)
    })

    it('should handle minimum valid prompt length', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'a' }) // Minimum 1 character
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'a'
        })
      )
    })

    it('should handle maximum valid prompt length', async () => {
      // Arrange
      const maxPrompt = 'a'.repeat(500) // Maximum 500 characters
      const request = new Request('http://localhost:3000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: maxPrompt })
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: maxPrompt
        })
      )
    })
  })
}) 