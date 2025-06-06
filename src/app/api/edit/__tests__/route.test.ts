/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

// Mock NextAuth using the ESM-compatible approach
const mockAuthEdit = jest.fn()
jest.mock('@/lib/next-auth', () => ({
  auth: mockAuthEdit,
}))

// Mock Prisma
const mockPrismaUserFindUnique = jest.fn()
const mockPrismaEditedImageCreate = jest.fn()
const mockPrismaGeneratedImageCreate = jest.fn()
const mockPrismaCreditTransactionUpdateMany = jest.fn()
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: mockPrismaUserFindUnique,
    },
    editedImage: {
      create: mockPrismaEditedImageCreate,
    },
    generatedImage: {
      create: mockPrismaGeneratedImageCreate,
    },
    creditTransaction: {
      updateMany: mockPrismaCreditTransactionUpdateMany,
    },
  },
}))

// Mock CreditService
jest.mock('@/lib/credit-service', () => ({
  CreditService: {
    spendCredits: global.mockCreditServiceSpendCredits,
  },
}))

// Mock CloudflareImagesService
const mockCloudflareUpload = jest.fn()
const mockCloudflareGetPublicUrl = jest.fn()
jest.mock('@/lib/cloudflare-images-service', () => ({
  CloudflareImagesService: jest.fn().mockImplementation(() => ({
    uploadImageFromUrl: mockCloudflareUpload,
    getPublicUrl: mockCloudflareGetPublicUrl,
  })),
}))

// Mock ReplicateService
const mockReplicateEditImage = jest.fn()
jest.mock('@/lib/replicate-service', () => ({
  ReplicateService: jest.fn().mockImplementation(() => ({
    editImageWithKontext: mockReplicateEditImage,
  })),
}))

// Mock subscription utils
const mockIsPremiumUser = jest.fn()
jest.mock('@/lib/subscription-utils', () => ({
  isPremiumUser: mockIsPremiumUser,
}))

describe('/api/edit', () => {
  // Import the handler after mocks are set up
  let POST: any
  
  beforeAll(async () => {
    // Dynamic import to ensure mocks are applied first
    const module = await import('@/app/api/edit/route')
    POST = module.POST
  })

  const mockEditRequest = {
    prompt: 'Make the sky more vibrant',
    imageUrl: 'https://example.com/test-image.jpg',
    seed: 12345,
  }

  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  }

  const mockUser = {
    id: 'user-123',
    credits: 10,
    subscriptionPlan: 'creator',
    subscriptionStatus: 'active',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Authentication & Authorization', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      mockAuthEdit.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
      expect(mockPrismaUserFindUnique).not.toHaveBeenCalled()
    })

    it('should return 401 when session has no user ID', async () => {
      // Arrange
      mockAuthEdit.mockResolvedValue({ user: {} })

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })

    it('should return 403 when user does not have premium access', async () => {
      // Arrange
      mockAuthEdit.mockResolvedValue(mockSession)
      mockPrismaUserFindUnique.mockResolvedValue(mockUser)
      mockIsPremiumUser.mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(403)
      expect(data.error).toBe('Premium access required. Please upgrade your subscription to use image editing.')
      expect(data.upgradeRequired).toBe(true)
      expect(mockIsPremiumUser).toHaveBeenCalledWith('creator', 'active')
    })

    it('should proceed when user has premium access', async () => {
      // Arrange
      mockAuthEdit.mockResolvedValue(mockSession)
      mockPrismaUserFindUnique.mockResolvedValue(mockUser)
      mockIsPremiumUser.mockReturnValue(true)
      global.mockCreditServiceSpendCredits.mockResolvedValue({ success: true, newBalance: 9 })
      mockReplicateEditImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/edited.jpg', width: 512, height: 512 }],
      })
      mockCloudflareUpload.mockResolvedValue({ success: true, imageId: 'cf-123' })
      mockCloudflareGetPublicUrl.mockReturnValue('https://cf.example.com/cf-123')
      mockPrismaEditedImageCreate.mockResolvedValue({
        id: 'edit-123',
        url: 'https://cf.example.com/cf-123',
        prompt: mockEditRequest.prompt,
        width: 512,
        height: 512,
        createdAt: new Date(),
        creditsUsed: 1,
      })

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockIsPremiumUser).toHaveBeenCalledWith('creator', 'active')
    })
  })

  describe('Input Validation', () => {
    beforeEach(() => {
      mockAuthEdit.mockResolvedValue(mockSession)
      mockPrismaUserFindUnique.mockResolvedValue(mockUser)
      mockIsPremiumUser.mockReturnValue(true)
    })

    it('should return 400 when prompt is missing', async () => {
      // Arrange
      const invalidRequest = {
        imageUrl: 'https://example.com/test-image.jpg',
        seed: 12345,
      }

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('Validation failed')
      expect(data.error).toContain('Required')
    })

    it('should return 400 when prompt is too long', async () => {
      // Arrange
      const invalidRequest = {
        prompt: 'a'.repeat(501), // Over 500 character limit
        imageUrl: 'https://example.com/test-image.jpg',
      }

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('Validation failed')
      expect(data.error).toContain('Prompt too long')
    })

    it('should return 400 when imageUrl is missing', async () => {
      // Arrange
      const invalidRequest = {
        prompt: 'Make the sky more vibrant',
        seed: 12345,
      }

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('Validation failed')
      expect(data.error).toContain('Required')
    })

    it('should return 400 when imageUrl is not a valid URL', async () => {
      // Arrange
      const invalidRequest = {
        prompt: 'Make the sky more vibrant',
        imageUrl: 'not-a-valid-url',
      }

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('Validation failed')
      expect(data.error).toContain('Valid image URL is required')
    })

    it('should accept valid request with optional seed', async () => {
      // Arrange
      global.mockCreditServiceSpendCredits.mockResolvedValue({ success: true, newBalance: 9 })
      mockReplicateEditImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/edited.jpg', width: 512, height: 512 }],
      })
      mockCloudflareUpload.mockResolvedValue({ success: true, imageId: 'cf-123' })
      mockCloudflareGetPublicUrl.mockReturnValue('https://cf.example.com/cf-123')
      mockPrismaEditedImageCreate.mockResolvedValue({
        id: 'edit-123',
        url: 'https://cf.example.com/cf-123',
        prompt: mockEditRequest.prompt,
        width: 512,
        height: 512,
        createdAt: new Date(),
        creditsUsed: 1,
      })

      const validRequest = {
        prompt: 'Make the sky more vibrant',
        imageUrl: 'https://example.com/test-image.jpg',
        // seed is optional
      }

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest),
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockReplicateEditImage).toHaveBeenCalledWith({
        input_image: validRequest.imageUrl,
        prompt: validRequest.prompt,
        seed: undefined,
      })
    })
  })

  describe('Credit Management', () => {
    beforeEach(() => {
      mockAuthEdit.mockResolvedValue(mockSession)
      mockIsPremiumUser.mockReturnValue(true)
    })

    it('should return 400 when user has insufficient credits', async () => {
      // Arrange
      const userWithNoCredits = { ...mockUser, credits: 0 }
      mockPrismaUserFindUnique.mockResolvedValue(userWithNoCredits)

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Insufficient credits')
      expect(global.mockCreditServiceSpendCredits).not.toHaveBeenCalled()
    })

    it('should return 400 when user is not found', async () => {
      // Arrange
      mockPrismaUserFindUnique.mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Insufficient credits')
    })

    it('should return 400 when credit service fails', async () => {
      // Arrange
      mockPrismaUserFindUnique.mockResolvedValue(mockUser)
      global.mockCreditServiceSpendCredits.mockResolvedValue({ 
        success: false, 
        error: 'Credit transaction failed',
        newBalance: 10 
      })
      mockReplicateEditImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/edited.jpg', width: 512, height: 512 }],
      })

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Credit transaction failed')
      expect(global.mockCreditServiceSpendCredits).toHaveBeenCalledWith(
        'user-123',
        1,
        'Image edit: Make the sky more vibrant',
        'image_edit',
        undefined,
        {
          prompt: mockEditRequest.prompt,
          model: 'black-forest-labs/flux-kontext-pro',
          provider: 'replicate',
          seed: mockEditRequest.seed,
        }
      )
    })

    it('should properly spend credits on successful edit', async () => {
      // Arrange
      mockPrismaUserFindUnique.mockResolvedValue(mockUser)
      global.mockCreditServiceSpendCredits.mockResolvedValue({ success: true, newBalance: 9 })
      mockReplicateEditImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/edited.jpg', width: 512, height: 512 }],
      })
      mockCloudflareUpload.mockResolvedValue({ success: true, imageId: 'cf-123' })
      mockCloudflareGetPublicUrl.mockReturnValue('https://cf.example.com/cf-123')
      mockPrismaEditedImageCreate.mockResolvedValue({
        id: 'edit-123',
        url: 'https://cf.example.com/cf-123',
        prompt: mockEditRequest.prompt,
        width: 512,
        height: 512,
        createdAt: new Date(),
        creditsUsed: 1,
      })

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.remainingCredits).toBe(9) // 10 - 1
      expect(global.mockCreditServiceSpendCredits).toHaveBeenCalledWith(
        'user-123',
        1,
        'Image edit: Make the sky more vibrant',
        'image_edit',
        undefined,
        {
          prompt: mockEditRequest.prompt,
          model: 'black-forest-labs/flux-kontext-pro',
          provider: 'replicate',
          seed: mockEditRequest.seed,
        }
      )
    })
  })

  describe('Replicate Integration', () => {
    beforeEach(() => {
      mockAuthEdit.mockResolvedValue(mockSession)
      mockPrismaUserFindUnique.mockResolvedValue(mockUser)
      mockIsPremiumUser.mockReturnValue(true)
      global.mockCreditServiceSpendCredits.mockResolvedValue({ success: true, newBalance: 9 })
    })

    it('should return 500 when edit fails', async () => {
      // Arrange
      mockReplicateEditImage.mockResolvedValue({
        status: 'failed',
        error: 'Model timeout',
      })

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Model timeout')
      expect(mockPrismaEditedImageCreate).not.toHaveBeenCalled()
    })

    it('should return 202 when edit is still processing', async () => {
      // Arrange
      mockReplicateEditImage.mockResolvedValue({
        status: 'processing',
      })

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(202)
      expect(data.error).toBe('Edit is still processing. Please try again in a moment.')
      expect(mockPrismaEditedImageCreate).not.toHaveBeenCalled()
    })

    it('should call Replicate with correct parameters', async () => {
      // Arrange
      mockReplicateEditImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/edited.jpg', width: 512, height: 512 }],
      })
      mockCloudflareUpload.mockResolvedValue({ success: true, imageId: 'cf-123' })
      mockCloudflareGetPublicUrl.mockReturnValue('https://cf.example.com/cf-123')
      mockPrismaEditedImageCreate.mockResolvedValue({
        id: 'edit-123',
        url: 'https://cf.example.com/cf-123',
        prompt: mockEditRequest.prompt,
        width: 512,
        height: 512,
        createdAt: new Date(),
        creditsUsed: 1,
      })

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      await POST(request)

      // Assert
      expect(mockReplicateEditImage).toHaveBeenCalledWith({
        input_image: mockEditRequest.imageUrl,
        prompt: mockEditRequest.prompt,
        seed: mockEditRequest.seed,
      })
    })

    it('should return 500 when edit returns no images', async () => {
      // Arrange
      mockReplicateEditImage.mockResolvedValue({
        status: 'completed',
        images: [], // No images returned
      })

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to edit image')
    })
  })

  describe('Cloudflare Integration', () => {
    beforeEach(() => {
      mockAuthEdit.mockResolvedValue(mockSession)
      mockPrismaUserFindUnique.mockResolvedValue(mockUser)
      mockIsPremiumUser.mockReturnValue(true)
      global.mockCreditServiceSpendCredits.mockResolvedValue({ success: true, newBalance: 9 })
      mockReplicateEditImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/edited.jpg', width: 512, height: 512 }],
      })
    })

    it('should fallback to temporary URL when Cloudflare upload fails', async () => {
      // Arrange
      mockCloudflareUpload.mockResolvedValue({ success: false })
      mockPrismaEditedImageCreate.mockResolvedValue({
        id: 'edit-123',
        url: 'https://example.com/edited.jpg', // Temporary URL
        prompt: mockEditRequest.prompt,
        width: 512,
        height: 512,
        createdAt: new Date(),
        creditsUsed: 1,
      })

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.url).toBe('https://example.com/edited.jpg')
      expect(mockPrismaEditedImageCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            url: 'https://example.com/edited.jpg',
            temporaryUrl: 'https://example.com/edited.jpg',
            cloudflareImageId: undefined,
          })
        })
      )
    })

    it('should use Cloudflare URL when upload succeeds', async () => {
      // Arrange
      mockCloudflareUpload.mockResolvedValue({ 
        success: true, 
        imageId: 'cf-123',
        originalResponse: {
          result: {
            size: 256000,
            metadata: { width: 1024, height: 1024 }
          }
        }
      })
      mockCloudflareGetPublicUrl.mockReturnValue('https://cf.example.com/cf-123')
      mockPrismaEditedImageCreate.mockResolvedValue({
        id: 'edit-123',
        url: 'https://cf.example.com/cf-123',
        prompt: mockEditRequest.prompt,
        width: 1024,
        height: 1024,
        createdAt: new Date(),
        creditsUsed: 1,
      })

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.url).toBe('https://cf.example.com/cf-123')
      expect(mockPrismaEditedImageCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            url: 'https://cf.example.com/cf-123',
            temporaryUrl: 'https://example.com/edited.jpg',
            cloudflareImageId: 'cf-123',
            fileSize: 256000,
            width: 1024,
            height: 1024,
          })
        })
      )
    })
  })

  describe('Database Operations', () => {
    beforeEach(() => {
      mockAuthEdit.mockResolvedValue(mockSession)
      mockPrismaUserFindUnique.mockResolvedValue(mockUser)
      mockIsPremiumUser.mockReturnValue(true)
      global.mockCreditServiceSpendCredits.mockResolvedValue({ success: true, newBalance: 9 })
      mockReplicateEditImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/edited.jpg', width: 512, height: 512 }],
      })
      mockCloudflareUpload.mockResolvedValue({ success: true, imageId: 'cf-123' })
      mockCloudflareGetPublicUrl.mockReturnValue('https://cf.example.com/cf-123')
    })

    it('should save edited image to database', async () => {
      // Arrange
      const mockSavedImage = {
        id: 'edit-123',
        userId: 'user-123',
        prompt: mockEditRequest.prompt,
        url: 'https://cf.example.com/cf-123',
        width: 512,
        height: 512,
        createdAt: new Date(),
        creditsUsed: 1,
        cloudflareImageId: 'cf-123',
        metadata: {
          model: 'black-forest-labs/flux-kontext-pro',
          provider: 'replicate',
        },
      }
      mockPrismaEditedImageCreate.mockResolvedValue(mockSavedImage)

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(mockPrismaEditedImageCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            prompt: mockEditRequest.prompt,
            url: 'https://cf.example.com/cf-123',
            width: 512,
            height: 512,
            seed: mockEditRequest.seed,
            creditsUsed: 1,
          })
        })
      )
      expect(data.id).toBe('edit-123')
      expect(data.url).toBe('https://cf.example.com/cf-123')
    })

    it('should create corresponding GeneratedImage record', async () => {
      // Arrange
      const mockSavedImage = {
        id: 'edit-123',
        userId: 'user-123',
        prompt: mockEditRequest.prompt,
        url: 'https://cf.example.com/cf-123',
        width: 512,
        height: 512,
        createdAt: new Date(),
        creditsUsed: 1,
        cloudflareImageId: 'cf-123',
        fileSize: 256000,
        metadata: {
          model: 'black-forest-labs/flux-kontext-pro',
          provider: 'replicate',
        },
        seed: mockEditRequest.seed,
      }
      mockPrismaEditedImageCreate.mockResolvedValue(mockSavedImage)

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      await POST(request)

      // Assert
      expect(mockPrismaGeneratedImageCreate).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          prompt: mockEditRequest.prompt,
          imageUrl: 'https://cf.example.com/cf-123',
          s3Key: null,
          cloudflareImageId: 'cf-123',
          fileSize: 256000,
          width: 512,
          height: 512,
          creditsUsed: 1,
          generationParams: {
            model: 'black-forest-labs/flux-kontext-pro',
            provider: 'replicate',
            seed: mockEditRequest.seed,
            source: 'edit'
          }
        }
      })
    })

    it('should update credit transaction with relatedEntityId', async () => {
      // Arrange
      const mockSavedImage = {
        id: 'edit-123',
        userId: 'user-123',
        prompt: mockEditRequest.prompt,
        url: 'https://cf.example.com/cf-123',
        width: 512,
        height: 512,
        createdAt: new Date(),
        creditsUsed: 1,
      }
      mockPrismaEditedImageCreate.mockResolvedValue(mockSavedImage)

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      await POST(request)

      // Assert
      expect(mockPrismaCreditTransactionUpdateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          type: 'spent',
          relatedEntityType: 'image_edit',
          relatedEntityId: null,
          createdAt: {
            gte: expect.any(Date)
          }
        },
        data: {
          relatedEntityId: 'edit-123'
        }
      })
    })

    it('should continue if GeneratedImage creation fails', async () => {
      // Arrange
      const mockSavedImage = {
        id: 'edit-123',
        userId: 'user-123',
        prompt: mockEditRequest.prompt,
        url: 'https://cf.example.com/cf-123',
        width: 512,
        height: 512,
        createdAt: new Date(),
        creditsUsed: 1,
      }
      mockPrismaEditedImageCreate.mockResolvedValue(mockSavedImage)
      mockPrismaGeneratedImageCreate.mockRejectedValue(new Error('DB error'))

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)

      // Assert - Should still return success even if GeneratedImage creation fails
      expect(response.status).toBe(200)
      expect(mockPrismaEditedImageCreate).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      mockAuthEdit.mockResolvedValue(mockSession)
      mockPrismaUserFindUnique.mockResolvedValue(mockUser)
      mockIsPremiumUser.mockReturnValue(true)
    })

    it('should return 500 for malformed JSON', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toContain('error')
    })

    it('should return 500 for database errors', async () => {
      // Arrange
      mockPrismaUserFindUnique.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Database connection failed')
    })

    it('should handle Replicate service errors', async () => {
      // Arrange
      global.mockCreditServiceSpendCredits.mockResolvedValue({ success: true, newBalance: 9 })
      mockReplicateEditImage.mockRejectedValue(new Error('Replicate API error'))

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Replicate API error')
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockAuthEdit.mockResolvedValue(mockSession)
      mockPrismaUserFindUnique.mockResolvedValue(mockUser)
      mockIsPremiumUser.mockReturnValue(true)
      global.mockCreditServiceSpendCredits.mockResolvedValue({ success: true, newBalance: 9 })
    })

    it('should handle very long prompts at the limit', async () => {
      // Arrange
      const longPrompt = 'a'.repeat(500) // Exactly at limit
      mockReplicateEditImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/edited.jpg', width: 512, height: 512 }],
      })
      mockCloudflareUpload.mockResolvedValue({ success: true, imageId: 'cf-123' })
      mockCloudflareGetPublicUrl.mockReturnValue('https://cf.example.com/cf-123')
      mockPrismaEditedImageCreate.mockResolvedValue({
        id: 'edit-123',
        url: 'https://cf.example.com/cf-123',
        prompt: longPrompt,
        width: 512,
        height: 512,
        createdAt: new Date(),
        creditsUsed: 1,
      })

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: longPrompt,
          imageUrl: 'https://example.com/test-image.jpg',
        }),
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(global.mockCreditServiceSpendCredits).toHaveBeenCalledWith(
        'user-123',
        1,
        `Image edit: ${longPrompt.substring(0, 100)}...`,
        'image_edit',
        undefined,
        expect.any(Object)
      )
    })

    it('should handle exactly 1 credit remaining', async () => {
      // Arrange
      const userWithOneCredit = { ...mockUser, credits: 1 }
      mockPrismaUserFindUnique.mockResolvedValue(userWithOneCredit)
      mockReplicateEditImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/edited.jpg', width: 512, height: 512 }],
      })
      mockCloudflareUpload.mockResolvedValue({ success: true, imageId: 'cf-123' })
      mockCloudflareGetPublicUrl.mockReturnValue('https://cf.example.com/cf-123')
      mockPrismaEditedImageCreate.mockResolvedValue({
        id: 'edit-123',
        url: 'https://cf.example.com/cf-123',
        prompt: mockEditRequest.prompt,
        width: 512,
        height: 512,
        createdAt: new Date(),
        creditsUsed: 1,
      })

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.remainingCredits).toBe(0) // 1 - 1 = 0
    })

    it('should handle missing image dimensions from Replicate', async () => {
      // Arrange
      mockReplicateEditImage.mockResolvedValue({
        status: 'completed',
        images: [{ url: 'https://example.com/edited.jpg' }], // No width/height
      })
      mockCloudflareUpload.mockResolvedValue({ success: true, imageId: 'cf-123' })
      mockCloudflareGetPublicUrl.mockReturnValue('https://cf.example.com/cf-123')
      mockPrismaEditedImageCreate.mockResolvedValue({
        id: 'edit-123',
        url: 'https://cf.example.com/cf-123',
        prompt: mockEditRequest.prompt,
        width: undefined,
        height: undefined,
        createdAt: new Date(),
        creditsUsed: 1,
      })

      const request = new NextRequest('http://localhost:3000/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockEditRequest),
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockPrismaEditedImageCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            width: undefined,
            height: undefined,
          })
        })
      )
    })
  })
}) 