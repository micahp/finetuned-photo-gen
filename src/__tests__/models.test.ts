/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

// Mock the database
jest.mock('@/lib/db', () => ({
  prisma: {
    userModel: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    trainingImage: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    jobQueue: {
      create: jest.fn(),
    },
  },
}))

// Mock NextAuth
jest.mock('@/lib/next-auth', () => ({
  auth: jest.fn(),
}))

import { prisma } from '@/lib/db'
import { auth } from '@/lib/next-auth'

describe('Model Management API', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    subscriptionStatus: 'active',
    subscriptionPlan: 'creator',
    credits: 10,
  }

  const mockSession = {
    user: mockUser,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(auth as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
    ;(prisma.userModel.count as jest.Mock).mockResolvedValue(0)
  })

  describe('POST /api/models/create', () => {
    it('should create a new model with uploaded training images', async () => {
      const mockModel = {
        id: 'model-123',
        name: 'Test Model',
        status: 'pending',
        userId: 'user-123',
        createdAt: new Date(),
      }

      const mockImages = [
        { id: 'img-1', filename: 'image1.jpg' },
        { id: 'img-2', filename: 'image2.jpg' },
        { id: 'img-3', filename: 'image3.jpg' },
      ]

      ;(prisma.userModel.create as jest.Mock).mockResolvedValue(mockModel)
      ;(prisma.trainingImage.findMany as jest.Mock).mockResolvedValue(mockImages)
      ;(prisma.trainingImage.updateMany as jest.Mock).mockResolvedValue({ count: 3 })
      ;(prisma.jobQueue.create as jest.Mock).mockResolvedValue({ id: 'job-123' })
      ;(prisma.userModel.update as jest.Mock).mockResolvedValue({ ...mockModel, status: 'training' })

      // This will fail until we implement the API endpoint
      const { POST } = await import('@/app/api/models/create/route')
      
      const request = new NextRequest('http://localhost:3000/api/models/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Model',
          description: 'Test model description',
          imageIds: ['img-1', 'img-2', 'img-3']
        }),
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(201)
      expect(result.success).toBe(true)
      expect(result.model.name).toBe('Test Model')
      expect(result.model.status).toBe('training')
      expect(prisma.userModel.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Model',
          status: 'pending',
          userId: 'user-123',
          triggerWord: 'test_model',
          baseModel: 'black-forest-labs/FLUX.1-dev',
        },
      })
    })

    it('should require authentication', async () => {
      ;(auth as jest.Mock).mockResolvedValue(null)

      const { POST } = await import('@/app/api/models/create/route')
      
      const request = new NextRequest('http://localhost:3000/api/models/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Model',
          description: 'Test model description',
          imageIds: ['img-1', 'img-2', 'img-3']
        }),
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toBe('Unauthorized')
    })

    it('should validate required fields', async () => {
      const { POST } = await import('@/app/api/models/create/route')
      
      const request = new NextRequest('http://localhost:3000/api/models/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing name and imageIds
          description: 'Test model description',
        }),
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toContain('Validation failed')
    })
  })

  describe('GET /api/models', () => {
    it('should return user models', async () => {
      const mockModels = [
        {
          id: 'model-1',
          name: 'Model 1',
          description: 'First model',
          status: 'completed',
          userId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { trainingImages: 5, generatedImages: 10 }
        },
        {
          id: 'model-2', 
          name: 'Model 2',
          description: 'Second model',
          status: 'training',
          userId: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { trainingImages: 8, generatedImages: 0 }
        }
      ]

      ;(prisma.userModel.findMany as jest.Mock).mockResolvedValue(mockModels)

      const { GET } = await import('@/app/api/models/route')
      
      const request = new NextRequest('http://localhost:3000/api/models')
      const response = await GET(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.models).toHaveLength(2)
      expect(result.models[0].name).toBe('Model 1')
      expect(result.models[1].status).toBe('training')
    })
  })
}) 