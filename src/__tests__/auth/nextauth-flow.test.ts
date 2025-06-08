/**
 * @jest-environment node
 */

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

describe('Core Authentication Logic Tests', () => {
  const testEmail = 'auth-logic-test@example.com'
  const testPassword = 'testpassword123'
  const testName = 'Auth Logic Test User'

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mock implementations
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$hashedpassword')
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
  })

  describe('Credentials Validation', () => {
    it('should authenticate valid user credentials', async () => {
      const mockUser = {
        id: 'test-id',
        email: testEmail,
        password: '$2a$12$hashedpassword',
        name: testName,
        subscriptionStatus: 'free',
        subscriptionPlan: null,
        stripeCustomerId: null,
        credits: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      const { validateCredentials } = await import('@/lib/auth')
      const result = await validateCredentials(testEmail, testPassword)

      expect(result).toBeTruthy()
      expect(result?.email).toBe(testEmail)
      expect(result?.name).toBe(testName)
      expect(result).not.toHaveProperty('password')
    })

    it('should reject invalid credentials', async () => {
      const mockUser = {
        id: 'test-id',
        email: testEmail,
        password: '$2a$12$hashedpassword',
        name: testName,
        subscriptionStatus: 'free',
        subscriptionPlan: null,
        stripeCustomerId: null,
        credits: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false) // Wrong password

      const { validateCredentials } = await import('@/lib/auth')
      const result = await validateCredentials(testEmail, 'wrongpassword')

      expect(result).toBeNull()
    })

    it('should reject non-existent user', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const { validateCredentials } = await import('@/lib/auth')
      const result = await validateCredentials('nonexistent@example.com', testPassword)

      expect(result).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database connection failed'))

      const { validateCredentials } = await import('@/lib/auth')
      
      // Should not throw but return null
      const result = await expect(validateCredentials(testEmail, testPassword)).resolves.toBeNull()
    })

    it('should handle bcrypt errors gracefully', async () => {
      const mockUser = {
        id: 'test-id',
        email: testEmail,
        password: '$2a$12$hashedpassword',
        name: testName,
        subscriptionStatus: 'free',
        subscriptionPlan: null,
        stripeCustomerId: null,
        credits: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockRejectedValue(new Error('Bcrypt error'))

      const { validateCredentials } = await import('@/lib/auth')
      
      // Should not throw but return null
      const result = await expect(validateCredentials(testEmail, testPassword)).resolves.toBeNull()
    })
  })

  describe('User Creation Flow', () => {
    it('should create user with hashed password', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      
      const mockCreatedUser = {
        id: 'test-id',
        email: testEmail,
        name: testName,
        subscriptionStatus: 'free',
        subscriptionPlan: null,
        stripeCustomerId: null,
        credits: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      
      ;(prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser)

      const { createUser } = await import('@/lib/auth')
      const result = await createUser(testEmail, testPassword, testName)

      expect(result.email).toBe(testEmail)
      expect(result.name).toBe(testName)
      expect(result.subscriptionStatus).toBe('free')
      expect(result.credits).toBe(3)
      expect(result).not.toHaveProperty('password')

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: testEmail,
          password: '$2a$12$hashedpassword',
          name: testName,
        },
        select: {
          id: true,
          email: true,
          name: true,
          isAdmin: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          stripeCustomerId: true,
          credits: true,
          createdAt: true,
          updatedAt: true,
          stripeSubscriptionId: true,
          stripePriceId: true,
          stripeCurrentPeriodEnd: true,
          stripeSubscriptionStatus: true,
          purchasedCreditPacks: true,
          lastApiCallAt: true,
          apiCallCount: true,
          emailPreferences: true,
          adminNotes: true,
          sessionInvalidatedAt: true,
        }
      })
    })

    it('should prevent duplicate user creation', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-id',
        email: testEmail,
        password: '$2a$12$hashedpassword',
      })

      const { createUser } = await import('@/lib/auth')
      
      await expect(createUser(testEmail, testPassword, testName))
        .rejects
        .toThrow('User with this email already exists')
    })
  })

  describe('Password Security', () => {
    it('should hash passwords before storing', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'test-id',
        email: testEmail,
        name: testName,
        subscriptionStatus: 'free',
        subscriptionPlan: null,
        stripeCustomerId: null,
        credits: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const { createUser } = await import('@/lib/auth')
      await createUser(testEmail, testPassword, testName)

      expect(bcrypt.hash).toHaveBeenCalledWith(testPassword, 12)
    })

    it('should verify passwords correctly', async () => {
      const mockUser = {
        id: 'test-id',
        email: testEmail,
        password: '$2a$12$hashedpassword',
        name: testName,
        subscriptionStatus: 'free',
        subscriptionPlan: null,
        stripeCustomerId: null,
        credits: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)

      const { validateCredentials } = await import('@/lib/auth')
      await validateCredentials(testEmail, testPassword)

      expect(bcrypt.compare).toHaveBeenCalledWith(testPassword, '$2a$12$hashedpassword')
    })
  })

  describe('Data Sanitization', () => {
    it('should normalize email addresses', async () => {
      const uppercaseEmail = 'TEST.USER@EXAMPLE.COM'
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'test-id',
        email: uppercaseEmail.toLowerCase(),
        name: testName,
        subscriptionStatus: 'free',
        subscriptionPlan: null,
        stripeCustomerId: null,
        credits: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const { createUser } = await import('@/lib/auth')
      const result = await createUser(uppercaseEmail, testPassword, testName)

      expect(result.email).toBe(uppercaseEmail.toLowerCase())
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: uppercaseEmail.toLowerCase(),
          password: '$2a$12$hashedpassword',
          name: testName,
        },
        select: {
          id: true,
          email: true,
          name: true,
          isAdmin: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          stripeCustomerId: true,
          credits: true,
          createdAt: true,
          updatedAt: true,
          stripeSubscriptionId: true,
          stripePriceId: true,
          stripeCurrentPeriodEnd: true,
          stripeSubscriptionStatus: true,
          purchasedCreditPacks: true,
          lastApiCallAt: true,
          apiCallCount: true,
          emailPreferences: true,
          adminNotes: true,
          sessionInvalidatedAt: true,
        }
      })
    })

    it('should never return password in user objects', async () => {
      const mockUser = {
        id: 'test-id',
        email: testEmail,
        password: '$2a$12$hashedpassword',
        name: testName,
        subscriptionStatus: 'free',
        subscriptionPlan: null,
        stripeCustomerId: null,
        credits: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      const { validateCredentials } = await import('@/lib/auth')
      const result = await validateCredentials(testEmail, testPassword)

      expect(result).not.toHaveProperty('password')

      // Check all returned properties
      const allowedProperties = ['id', 'email', 'name', 'subscriptionStatus', 'subscriptionPlan', 'stripeCustomerId', 'credits', 'createdAt', 'updatedAt']
      if (result) {
        Object.keys(result).forEach(key => {
          expect(allowedProperties).toContain(key)
        })
      }
    })
  })
}) 