/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

// Mock the generate route
jest.mock('@/app/api/generate/route', () => ({
  POST: jest.fn(),
}))

// Mock dependencies
jest.mock('@/lib/next-auth')
jest.mock('@/lib/db')
jest.mock('@/lib/together-ai')

const mockPOST = require('@/app/api/generate/route').POST as jest.Mock
const mockAuth = require('@/lib/next-auth').auth as jest.Mock
const mockPrisma = require('@/lib/db').prisma as any
const mockTogetherAI = require('@/lib/together-ai').TogetherAIService as jest.Mock

// Mock Prisma methods
const mockPrismaUserFindUnique = jest.fn()
const mockPrismaUserModelFindFirst = jest.fn()
const mockPrismaUserModelUpdate = jest.fn()
const mockPrismaUserUpdate = jest.fn()

mockPrisma.user = {
  findUnique: mockPrismaUserFindUnique,
  update: mockPrismaUserUpdate,
}
mockPrisma.userModel = {
  findFirst: mockPrismaUserModelFindFirst,
  update: mockPrismaUserModelUpdate,
}

// Mock TogetherAI service
const mockGenerateWithLoRA = jest.fn()
mockTogetherAI.mockImplementation(() => ({
  generateWithLoRA: mockGenerateWithLoRA,
  generateImage: jest.fn(),
}))

describe('Corruption Detection Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default auth mock
    mockAuth.mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com' }
    })
    
    // Default user with credits
    mockPrismaUserFindUnique.mockResolvedValue({
      credits: 10
    })
  })

  const createRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  }

  const mockCorruptedModel = {
    id: 'model-123',
    name: 'Corrupted Model',
    status: 'ready',
    loraReadyForInference: true,
    huggingfaceRepo: 'test/corrupted-repo',
    triggerWord: 'test'
  }

  describe('Original Together.AI Error Messages', () => {
    it('should detect HeaderTooLarge error', async () => {
      mockPrismaUserModelFindFirst.mockResolvedValue(mockCorruptedModel)
      mockGenerateWithLoRA.mockResolvedValue({
        status: 'failed',
        error: 'HeaderTooLarge: The header is too large to process'
      })

      const request = createRequest({
        prompt: 'test prompt',
        userModelId: 'model-123',
        modelId: 'black-forest-labs/FLUX.1-schnell-Free',
        style: 'none',
        aspectRatio: '1:1',
        steps: 4
      })

      const response = await mockPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('corrupted and has been disabled')
      expect(mockPrismaUserModelUpdate).toHaveBeenCalledWith({
        where: { id: 'model-123' },
        data: {
          validationStatus: 'invalid',
          validationError: 'Model file is corrupted. The safetensors file needs to be regenerated.',
          validationErrorType: 'corrupted_safetensors',
          lastValidationCheck: expect.any(Date),
          loraReadyForInference: false
        }
      })
    })

    it('should detect deserializing header error', async () => {
      mockPrismaUserModelFindFirst.mockResolvedValue(mockCorruptedModel)
      mockGenerateWithLoRA.mockResolvedValue({
        status: 'failed',
        error: 'Error while deserializing header: invalid format'
      })

      const request = createRequest({
        prompt: 'test prompt',
        userModelId: 'model-123',
        modelId: 'black-forest-labs/FLUX.1-schnell-Free',
        style: 'none',
        aspectRatio: '1:1',
        steps: 4
      })

      const response = await mockPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('corrupted and has been disabled')
      expect(mockPrismaUserModelUpdate).toHaveBeenCalled()
    })
  })

  describe('Transformed Error Messages', () => {
    it('should detect transformed corruption error', async () => {
      mockPrismaUserModelFindFirst.mockResolvedValue(mockCorruptedModel)
      mockGenerateWithLoRA.mockResolvedValue({
        status: 'failed',
        error: 'The LoRA model file appears to be corrupted or incompatible. This usually happens when the safetensors file was generated incorrectly during training.'
      })

      const request = createRequest({
        prompt: 'test prompt',
        userModelId: 'model-123',
        modelId: 'black-forest-labs/FLUX.1-schnell-Free',
        style: 'none',
        aspectRatio: '1:1',
        steps: 4
      })

      const response = await mockPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('corrupted and has been disabled')
      expect(mockPrismaUserModelUpdate).toHaveBeenCalled()
    })

    it('should detect file integrity error', async () => {
      mockPrismaUserModelFindFirst.mockResolvedValue(mockCorruptedModel)
      mockGenerateWithLoRA.mockResolvedValue({
        status: 'failed',
        error: 'Please re-train the model or check the file integrity. Original error: HeaderTooLarge'
      })

      const request = createRequest({
        prompt: 'test prompt',
        userModelId: 'model-123',
        modelId: 'black-forest-labs/FLUX.1-schnell-Free',
        style: 'none',
        aspectRatio: '1:1',
        steps: 4
      })

      const response = await mockPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('corrupted and has been disabled')
      expect(mockPrismaUserModelUpdate).toHaveBeenCalled()
    })
  })

  describe('Non-corruption Errors', () => {
    it('should not mark model as corrupted for rate limit errors', async () => {
      mockPrismaUserModelFindFirst.mockResolvedValue(mockCorruptedModel)
      mockGenerateWithLoRA.mockResolvedValue({
        status: 'failed',
        error: 'Rate limit exceeded. Please try again later.'
      })

      const request = createRequest({
        prompt: 'test prompt',
        userModelId: 'model-123',
        modelId: 'black-forest-labs/FLUX.1-schnell-Free',
        style: 'none',
        aspectRatio: '1:1',
        steps: 4
      })

      const response = await mockPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Rate limit exceeded. Please try again later.')
      expect(mockPrismaUserModelUpdate).not.toHaveBeenCalled()
    })

    it('should not mark model as corrupted for network errors', async () => {
      mockPrismaUserModelFindFirst.mockResolvedValue(mockCorruptedModel)
      mockGenerateWithLoRA.mockResolvedValue({
        status: 'failed',
        error: 'Network timeout occurred'
      })

      const request = createRequest({
        prompt: 'test prompt',
        userModelId: 'model-123',
        modelId: 'black-forest-labs/FLUX.1-schnell-Free',
        style: 'none',
        aspectRatio: '1:1',
        steps: 4
      })

      const response = await mockPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Network timeout occurred')
      expect(mockPrismaUserModelUpdate).not.toHaveBeenCalled()
    })
  })

  describe('Base Model Generation', () => {
    it('should not attempt corruption detection for base models', async () => {
      mockGenerateWithLoRA.mockResolvedValue({
        status: 'failed',
        error: 'HeaderTooLarge: Some error'
      })

      const request = createRequest({
        prompt: 'test prompt',
        modelId: 'black-forest-labs/FLUX.1-schnell-Free',
        style: 'none',
        aspectRatio: '1:1',
        steps: 4
        // No userModelId - using base model
      })

      const response = await mockPOST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('HeaderTooLarge: Some error')
      expect(mockPrismaUserModelUpdate).not.toHaveBeenCalled()
    })
  })
}) 