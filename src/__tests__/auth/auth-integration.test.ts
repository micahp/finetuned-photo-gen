/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST as registerPOST } from '@/app/api/auth/register/route'
import { POST as validatePOST } from '@/app/api/auth/validate/route'

// Mock the database
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

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
          subscriptionStatus: true,
          subscriptionPlan: true,
          stripeCustomerId: true,
          credits: true,
          createdAt: true,
          updatedAt: true,
        }
      })
    })

    it('should reject registration with duplicate email', async () => {
      // Mock user already exists
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-id',
        email: testEmail,
        password: 'hashedpassword',
      })

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          password: 'differentpassword',
          name: 'Different Name'
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

    it('should reject registration with invalid email', async () => {
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
      expect(responseData.error).toContain('Invalid email format')
    })

    it('should reject registration with short password', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          password: '123',
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
      expect(responseData.error).toContain('at least 6 characters')
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

    it('should reject login for non-existent user', async () => {
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

      // Step 1: Registration
      ;(prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // User doesn't exist for registration
        .mockResolvedValueOnce({ ...mockUser, password: '$2a$12$hashedpassword' }) // User exists for login
      ;(prisma.user.create as jest.Mock).mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      // Register user
      const registerRequest = new NextRequest('http://localhost:3000/api/auth/register', {
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

      const registerResponse = await registerPOST(registerRequest)
      const registerData = await registerResponse.json()

      expect(registerResponse.status).toBe(201)
      expect(registerData.success).toBe(true)

      // Step 2: Validate login credentials
      const loginRequest = new NextRequest('http://localhost:3000/api/auth/validate', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          password: testPassword
        }),
        headers: {
          'content-type': 'application/json',
        },
      })

      const loginResponse = await validatePOST(loginRequest)
      const loginData = await loginResponse.json()

      expect(loginResponse.status).toBe(200)
      expect(loginData.email).toBe(testEmail)
      expect(loginData.name).toBe(testName)
      expect(loginData.id).toBe(registerData.data.user.id)
    })
  })
}) 