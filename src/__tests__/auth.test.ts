/**
 * @jest-environment node
 */

import { createUser, validateCredentials } from '@/lib/auth'

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}))

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

describe('Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createUser', () => {
    it('should create a new user with valid credentials', async () => {
      // Mock that user doesn't exist
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
      
      // Mock bcrypt.hash to return a hashed password
      ;(bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$hashedpassword')
      
      // Mock user creation
      const mockUser = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
        subscriptionStatus: 'free',
        subscriptionPlan: null,
        stripeCustomerId: null,
        credits: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      ;(prisma.user.create as jest.Mock).mockResolvedValue(mockUser)

      const result = await createUser('test@example.com', 'password123', 'Test User')

      expect(result).toEqual(mockUser)
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      })
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          password: '$2a$12$hashedpassword', // hashed password
          name: 'Test User',
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
        }
      })
    })

    it('should throw error for duplicate email', async () => {
      // Mock that user already exists
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-id',
        email: 'duplicate@example.com',
        password: 'hashedpassword',
      })

      await expect(createUser('duplicate@example.com', 'password123'))
        .rejects
        .toThrow('User with this email already exists')
    })
  })

  describe('validateCredentials', () => {
    it('should return user for valid credentials', async () => {
      const hashedPassword = '$2a$12$test.hashed.password'
      const mockUser = {
        id: 'test-id',
        email: 'test@example.com',
        password: hashedPassword,
        name: 'Test User',
        subscriptionStatus: 'free',
        subscriptionPlan: null,
        stripeCustomerId: null,
        credits: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)

      // Mock bcrypt.compare to return true
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      const result = await validateCredentials('test@example.com', 'password123')

      expect(result).toEqual({
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
        subscriptionStatus: 'free',
        subscriptionPlan: null,
        stripeCustomerId: null,
        credits: 3,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      })
      expect(result).not.toHaveProperty('password')
    })

    it('should return null for invalid credentials', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await validateCredentials('nonexistent@example.com', 'password123')

      expect(result).toBeNull()
    })
  })
}) 