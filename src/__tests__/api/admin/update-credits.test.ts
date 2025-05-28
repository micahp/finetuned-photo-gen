/**
 * @jest-environment node
 */

// Mock admin authentication
const mockRequireAdmin = jest.fn()
jest.mock('@/lib/admin-auth', () => ({
  requireAdmin: mockRequireAdmin,
}))

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
    // Default: admin authentication passes
    mockRequireAdmin.mockResolvedValue(null)
  })

  describe('POST - Admin Authentication', () => {
    it('should return 403 when user is not admin', async () => {
      // Arrange - Mock admin check to fail
      const mockErrorResponse = {
        json: () => Promise.resolve({ error: 'Admin access required' }),
        status: 403
      }
      mockRequireAdmin.mockResolvedValue(mockErrorResponse)

      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', credits: 50 })
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response).toBe(mockErrorResponse)
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
      expect(mockPrismaUpdate).not.toHaveBeenCalled()
    })

    it('should proceed when user is admin', async () => {
      // Arrange - Admin check passes
      mockRequireAdmin.mockResolvedValue(null)
      
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
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockPrismaUpdate).toHaveBeenCalled()
    })
  })

  describe('POST - Input Validation (Admin Authenticated)', () => {
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
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
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
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
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
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
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
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
      expect(response.status).toBe(400)
      expect(data.error).toBe('Email and credits (number) are required')
      expect(mockPrismaUpdate).not.toHaveBeenCalled()
    })
  })

  describe('POST - Successful Credit Updates (Admin Authenticated)', () => {
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
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
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
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
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
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
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
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user.credits).toBe(-10)
    })
  })

  describe('POST - Error Handling (Admin Authenticated)', () => {
    it('should return 404 when user is not found', async () => {
      // Arrange
      const error = new Error('Record to update not found')
      mockPrismaUpdate.mockRejectedValue(error)

      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@example.com', credits: 50 })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
      expect(response.status).toBe(404)
      expect(data.error).toBe('User not found')
    })

    it('should return 500 for database connection errors', async () => {
      // Arrange
      const error = new Error('Database connection failed')
      mockPrismaUpdate.mockRejectedValue(error)

      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', credits: 50 })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('POST - Edge Cases (Admin Authenticated)', () => {
    it('should handle very large credit amounts', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
        credits: 999999999,
      }
      
      mockPrismaUpdate.mockResolvedValue(mockUser)

      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', credits: 999999999 })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user.credits).toBe(999999999)
    })

    it('should handle decimal credit amounts', async () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'John Doe',
        credits: 50.5,
      }
      
      mockPrismaUpdate.mockResolvedValue(mockUser)

      const request = new Request('http://localhost:3000/api/admin/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', credits: 50.5 })
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(mockRequireAdmin).toHaveBeenCalledTimes(1)
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user.credits).toBe(50.5)
    })
  })
}) 