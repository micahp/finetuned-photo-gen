/**
 * @jest-environment node
 */

// Use ESM-compatible imports and mocking
import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

// Mock NextAuth using the ESM-compatible approach
const mockAuth = jest.fn()
jest.mock('@/lib/next-auth', () => ({
  auth: mockAuth,
}))

// Mock Prisma 
const mockPrismaFindMany = jest.fn()
const mockPrismaCount = jest.fn()
jest.mock('@/lib/db', () => ({
  prisma: {
    generatedImage: {
      findMany: mockPrismaFindMany,
      count: mockPrismaCount,
    },
  },
}))

describe('/api/gallery', () => {
  // Import the handler after mocks are set up
  let GET: any
  
  beforeAll(async () => {
    // Dynamic import to ensure mocks are applied first
    const module = await import('@/app/api/gallery/route')
    GET = module.GET
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET - Authentication Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      mockAuth.mockResolvedValue(null)
      
      const { req } = createMocks({
        method: 'GET',
        url: '/api/gallery',
      })
      
      const request = new Request('http://localhost:3000/api/gallery')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
      expect(mockPrismaFindMany).not.toHaveBeenCalled()
    })

    it('should return 401 when session exists but user.id is missing', async () => {
      // Arrange
      mockAuth.mockResolvedValue({ 
        user: { id: undefined } 
      })
      
      const request = new Request('http://localhost:3000/api/gallery')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('GET - Successful Gallery Retrieval', () => {
    const mockUser = { id: 'user-123' }
    const mockImages = [
      {
        id: 'img-1',
        prompt: 'A beautiful sunset',
        imageUrl: 'https://example.com/sunset.jpg',
        generationParams: { model: 'flux', width: 512, height: 512 },
        creditsUsed: 1,
        createdAt: new Date('2024-01-15T10:00:00Z'),
      },
      {
        id: 'img-2', 
        prompt: 'A mountain landscape',
        imageUrl: 'https://example.com/mountain.jpg',
        generationParams: { model: 'flux', width: 1024, height: 1024 },
        creditsUsed: 2,
        createdAt: new Date('2024-01-14T09:00:00Z'),
      }
    ]

    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: mockUser })
    })

    it('should return user images with default pagination', async () => {
      // Arrange
      mockPrismaFindMany.mockResolvedValue(mockImages)
      mockPrismaCount.mockResolvedValue(2)
      
      const request = new Request('http://localhost:3000/api/gallery')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.images).toHaveLength(2)
      
      // Verify first image structure
      expect(data.images[0]).toEqual({
        id: 'img-1',
        prompt: 'A beautiful sunset',
        imageUrl: 'https://example.com/sunset.jpg',
        generationParams: { model: 'flux', width: 512, height: 512 },
        creditsUsed: 1,
        createdAt: '2024-01-15T10:00:00.000Z',
      })

      // Verify pagination metadata
      expect(data.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      })

      // Verify database calls
      expect(mockPrismaFindMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        select: {
          id: true,
          prompt: true,
          imageUrl: true,
          generationParams: true,
          creditsUsed: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50,
      })
    })

    it('should handle custom pagination parameters', async () => {
      // Arrange
      mockPrismaFindMany.mockResolvedValue([mockImages[0]])
      mockPrismaCount.mockResolvedValue(10)
      
      const request = new Request('http://localhost:3000/api/gallery?page=2&limit=5')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 10,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      })

      expect(mockPrismaFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5, // (page 2 - 1) * limit 5
          take: 5,
        })
      )
    })

    it('should return empty array when user has no images', async () => {
      // Arrange
      mockPrismaFindMany.mockResolvedValue([])
      mockPrismaCount.mockResolvedValue(0)
      
      const request = new Request('http://localhost:3000/api/gallery')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.images).toEqual([])
      expect(data.pagination.total).toBe(0)
    })
  })

  describe('GET - Error Handling', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
    })

    it('should return 500 when database query fails', async () => {
      // Arrange
      mockPrismaFindMany.mockRejectedValue(new Error('Database connection failed'))
      
      const request = new Request('http://localhost:3000/api/gallery')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should handle invalid pagination parameters gracefully', async () => {
      // Arrange
      mockPrismaFindMany.mockResolvedValue([])
      mockPrismaCount.mockResolvedValue(0)
      
      const request = new Request('http://localhost:3000/api/gallery?page=abc&limit=xyz')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert - should default to page 1, limit 50
      expect(response.status).toBe(200)
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(50)
    })
  })

  describe('GET - Edge Cases', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
    })

    it('should handle large page numbers gracefully', async () => {
      // Arrange
      mockPrismaFindMany.mockResolvedValue([])
      mockPrismaCount.mockResolvedValue(5)
      
      const request = new Request('http://localhost:3000/api/gallery?page=100')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.pagination.page).toBe(100)
      expect(data.pagination.hasNext).toBe(false)
      expect(data.images).toEqual([])
    })

    it('should enforce reasonable limits on pagination', async () => {
      // Arrange
      mockPrismaFindMany.mockResolvedValue([])
      mockPrismaCount.mockResolvedValue(0)
      
      const request = new Request('http://localhost:3000/api/gallery?limit=1000')

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
      // The implementation should enforce a maximum limit of 100 for security
      expect(mockPrismaFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // Max limit enforced
        })
      )
    })
  })
}) 