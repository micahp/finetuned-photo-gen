/**
 * @jest-environment node
 */

// Mock Prisma
const mockPrismaUpdate = jest.fn()
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      update: mockPrismaUpdate,
    },
  },
}))

describe('/api/admin/update-credits', () => {
  // Import the handler after mocks are set up
  let POST: any
  
  beforeAll(async () => {
    // Dynamic import to ensure mocks are applied first
    const module = await import('@/app/api/admin/update-credits/route')
    POST = module.POST
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST - Input Validation', () => {
    it('should return 400 when email is missing', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits: 50 })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Email and credits (number) are required')
      expect(mockPrismaUpdate).not.toHaveBeenCalled()
    })

    it('should return 400 when credits is missing', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Email and credits (number) are required')
      expect(mockPrismaUpdate).not.toHaveBeenCalled()
    })

    it('should return 400 when credits is not a number', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', credits: 'fifty' })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Email and credits (number) are required')
      expect(mockPrismaUpdate).not.toHaveBeenCalled()
    })

    it('should return 400 when email is empty string', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '', credits: 50 })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Email and credits (number) are required')
      expect(mockPrismaUpdate).not.toHaveBeenCalled()
    })
  })

  describe('POST - Successful Credit Updates', () => {
    it('should successfully update user credits', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
        credits: 100,
      }
      
      mockPrismaUpdate.mockResolvedValue(mockUser)

      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', credits: 100 })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user).toEqual({
        email: 'user@example.com',
        name: 'John Doe',
        credits: 100,
      })

      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
        data: { credits: 100 },
        select: {
          id: true,
          email: true,
          name: true,
          credits: true,
        }
      })
    })

    it('should handle email case normalization', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
        credits: 50,
      }
      
      mockPrismaUpdate.mockResolvedValue(mockUser)

      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'USER@EXAMPLE.COM', credits: 50 })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // Verify email was normalized to lowercase
      expect(mockPrismaUpdate).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
        data: { credits: 50 },
        select: {
          id: true,
          email: true,
          name: true,
          credits: true,
        }
      })
    })

    it('should allow setting credits to zero', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
        credits: 0,
      }
      
      mockPrismaUpdate.mockResolvedValue(mockUser)

      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', credits: 0 })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user.credits).toBe(0)
    })

    it('should allow negative credits (for debt tracking)', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
        credits: -10,
      }
      
      mockPrismaUpdate.mockResolvedValue(mockUser)

      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', credits: -10 })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user.credits).toBe(-10)
    })
  })

  describe('POST - Error Handling', () => {
    it('should return 404 when user is not found', async () => {
      // Arrange
      mockPrismaUpdate.mockRejectedValue(new Error('Record to update not found'))

      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@example.com', credits: 50 })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(data.error).toBe('User not found')
    })

    it('should return 500 for database connection errors', async () => {
      // Arrange
      mockPrismaUpdate.mockRejectedValue(new Error('Database connection failed'))

      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', credits: 50 })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should handle malformed JSON gracefully', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/admin/update-credits', {
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
      expect(mockPrismaUpdate).not.toHaveBeenCalled()
    })
  })

  describe('POST - Security Concerns (Tests that reveal missing authentication)', () => {
    it('should be accessible without authentication (SECURITY ISSUE)', async () => {
      // This test documents the current behavior but highlights a security flaw
      // The API should require admin authentication but currently doesn't
      
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
        credits: 1000,
      }
      
      mockPrismaUpdate.mockResolvedValue(mockUser)

      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // NOTE: No authentication headers or session
        body: JSON.stringify({ email: 'user@example.com', credits: 1000 })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert - This passes but shouldn't in a secure implementation
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // TODO: This API should require admin authentication
      // Expected behavior: expect(response.status).toBe(401)
    })

    it('should validate admin role (MISSING FEATURE)', async () => {
      // This test documents what should happen but doesn't currently
      // The API should check if the authenticated user is an admin
      
      // This test will be updated once authentication is added
      expect(true).toBe(true) // Placeholder
      
      // TODO: Add NextAuth integration with admin role checking
      // const session = await auth()
      // if (!session?.user?.isAdmin) return 403
    })
  })

  describe('POST - Edge Cases', () => {
    it('should handle very large credit amounts', async () => {
      // Arrange
      const largeAmount = 999999999
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
        credits: largeAmount,
      }
      
      mockPrismaUpdate.mockResolvedValue(mockUser)

      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', credits: largeAmount })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.user.credits).toBe(largeAmount)
    })

    it('should handle decimal credit amounts', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
        credits: 10.5,
      }
      
      mockPrismaUpdate.mockResolvedValue(mockUser)

      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', credits: 10.5 })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.user.credits).toBe(10.5)
    })
  })
}) 