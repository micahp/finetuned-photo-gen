/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST as registerPOST } from '@/app/api/auth/register/route'
import { POST as validatePOST } from '@/app/api/auth/validate/route'

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

// Clean up test database before/after tests
describe('Authentication Integration Tests', () => {
  const testEmail = 'test-integration@example.com'
  const testPassword = 'testpassword123'
  const testName = 'Test Integration User'

  beforeEach(() => {
    jest.clearAllMocks()
    // Set up default mock implementations
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$hashedpassword')
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
  })

  describe('User Registration Flow', () => {
    it('should successfully register a new user via API', async () => {
      // Mock user doesn't exist
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      
      // Mock user creation
      const mockUser = {
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
      ;(prisma.user.create as jest.Mock).mockResolvedValue(mockUser)

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: testName
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await registerPOST(request)
      const responseData = await response.json()

      expect(response.status).toBe(201)
      expect(responseData.success).toBe(true)
      expect(responseData.data.user.email).toBe(testEmail)
      expect(responseData.data.user.name).toBe(testName)
      expect(responseData.data.user).not.toHaveProperty('password')

      // Verify database calls
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: testEmail }
      })
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
        },
      })
    })

    it('should reject registration with duplicate email', async () => {
      // Mock user already exists
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-id',
        email: testEmail,
        password: '$2a$12$hashedpassword',
      })

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: testName
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await registerPOST(request)
      const responseData = await response.json()

      expect(response.status).toBe(409)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toContain('already exists')
    })

    it('should handle invalid request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          // Missing required fields
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await registerPOST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toContain('required')
    })

    it('should validate email format', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
          password: testPassword,
          name: testName
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await registerPOST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toContain('valid email')
    })

    it('should validate password length', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          password: '123', // Too short
          name: testName
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await registerPOST(request)
      const responseData = await response.json()

      expect(response.status).toBe(400)
      expect(responseData.success).toBe(false)
      expect(responseData.error).toContain('6 characters')
    })
  })

  describe('User Login Flow', () => {
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

    it('should successfully validate user credentials via API', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      const request = new NextRequest('http://localhost:3000/api/auth/validate', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          password: testPassword
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await validatePOST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.email).toBe(testEmail)
      expect(responseData.name).toBe(testName)
      expect(responseData).not.toHaveProperty('password')
    })

    it('should reject invalid credentials', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false) // Wrong password

      const request = new NextRequest('http://localhost:3000/api/auth/validate', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          password: 'wrongpassword'
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await validatePOST(request)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.error).toContain('Invalid credentials')
    })

    it('should reject non-existent user', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/auth/validate', {
        method: 'POST',
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: testPassword
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const response = await validatePOST(request)
      const responseData = await response.json()

      expect(response.status).toBe(401)
      expect(responseData.error).toContain('Invalid credentials')
    })
  })

  describe('Complete Signup-Login Flow', () => {
    it('should complete full signup then login flow', async () => {
      // Step 1: Register a new user
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      
      const mockUser = {
        id: 'flow-test-id',
        email: 'flow-test@example.com',
        name: 'Flow Test User',
        subscriptionStatus: 'free',
        subscriptionPlan: null,
        stripeCustomerId: null,
        credits: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      ;(prisma.user.create as jest.Mock).mockResolvedValue(mockUser)

      const registerRequest = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'flow-test@example.com',
          password: 'flowtest123',
          name: 'Flow Test User'
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const registerResponse = await registerPOST(registerRequest)
      const registerData = await registerResponse.json()

      expect(registerResponse.status).toBe(201)
      expect(registerData.success).toBe(true)

      // Step 2: Validate login credentials
      const userWithPassword = { ...mockUser, password: '$2a$12$hashedpassword' }
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(userWithPassword)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      const validateRequest = new NextRequest('http://localhost:3000/api/auth/validate', {
        method: 'POST',
        body: JSON.stringify({
          email: 'flow-test@example.com',
          password: 'flowtest123'
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const validateResponse = await validatePOST(validateRequest)
      const validateData = await validateResponse.json()

      expect(validateResponse.status).toBe(200)
      expect(validateData.email).toBe('flow-test@example.com')
      expect(validateData.name).toBe('Flow Test User')
      expect(validateData).not.toHaveProperty('password')
    })
  })
}) 