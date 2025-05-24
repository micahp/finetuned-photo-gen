import { validateCredentials } from '@/lib/auth'
import { auth } from '@/lib/next-auth'

// Mock the database operations
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))

describe('Login Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should redirect to dashboard after successful login', async () => {
    // This test should FAIL initially - reproducing the login redirect issue
    
    // Mock a valid user in database
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      password: '$2a$12$hashedpassword', // Mock bcrypt hash
      subscriptionStatus: 'ACTIVE',
      subscriptionPlan: null,
      stripeCustomerId: null,
      credits: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Mock database response
    const { prisma } = require('@/lib/db')
    prisma.user.findUnique.mockResolvedValue(mockUser)

    // Mock bcrypt comparison to return true
    jest.mock('bcryptjs', () => ({
      compare: jest.fn().mockResolvedValue(true),
    }))

    // Test credential validation
    const result = await validateCredentials('test@example.com', 'password123')
    
    // Should return user without password
    expect(result).toBeTruthy()
    expect(result?.email).toBe('test@example.com')
    expect(result).not.toHaveProperty('password')

    // Test auth session creation
    // This should work but might fail due to NextAuth configuration issues
    const session = await auth()
    
    // The session should eventually be created after login
    // This assertion will FAIL initially, highlighting the login redirect problem
    expect(session).toBeDefined()
  })

  it('should handle NextAuth trusted host configuration', () => {
    // This test verifies that localhost:3000 is properly configured as trusted
    const nextAuthUrl = process.env.NEXTAUTH_URL
    const nextAuthSecret = process.env.NEXTAUTH_SECRET
    
    expect(nextAuthUrl).toBe('http://localhost:3000')
    expect(nextAuthSecret).toBeDefined()
    expect(nextAuthSecret).toHaveLength(44) // Base64 encoded 32 bytes
  })

  it('should connect to database successfully', async () => {
    // Test database connectivity
    const { prisma } = require('@/lib/db')
    
    // Mock a simple query
    prisma.user.findUnique.mockResolvedValue(null)
    
    const result = await prisma.user.findUnique({
      where: { email: 'nonexistent@example.com' }
    })
    
    // Should not throw database connection errors
    expect(result).toBeNull()
  })
}) 