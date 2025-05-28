/**
 * @jest-environment node
 */

// Mock NextAuth using the ESM-compatible approach
const mockAuth = jest.fn()
jest.mock('@/lib/next-auth', () => ({
  auth: mockAuth,
}))

// Mock CreditService
const mockCheckUsageLimits = jest.fn()
const mockGetLowCreditNotification = jest.fn()
jest.mock('@/lib/credit-service', () => ({
  CreditService: {
    checkUsageLimits: mockCheckUsageLimits,
    getLowCreditNotification: mockGetLowCreditNotification,
  },
}))

// Mock Prisma
const mockPrismaUserModelCreate = jest.fn()
const mockPrismaJobQueueCreate = jest.fn()
jest.mock('@/lib/db', () => ({
  prisma: {
    userModel: {
      create: mockPrismaUserModelCreate,
      update: jest.fn(),
    },
    jobQueue: {
      create: mockPrismaJobQueueCreate,
    },
  },
}))

describe('/api/models/create - Usage Limits Enforcement', () => {
  let POST: any
  
  beforeAll(async () => {
    // Dynamic import to ensure mocks are applied first
    const module = await import('../route')
    POST = module.POST
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should block model creation when user has reached model limit', async () => {
    // Arrange
    mockAuth.mockResolvedValue({ user: { id: 'user123' } })
    mockCheckUsageLimits.mockResolvedValue({
      maxCreditsPerMonth: 1000,
      maxModels: 1,
      currentCredits: 500,
      currentModels: 1, // At limit
      canCreateModel: false, // Cannot create more models
      canGenerateImage: true,
      warningThreshold: 100,
      isNearLimit: false,
    })

    const request = new Request('http://localhost:3000/api/models/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Model',
        skipTraining: true,
      })
    })

    // Act
    const response = await POST(request)
    const responseBody = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(responseBody.error).toBe('Model limit reached')
    expect(responseBody.details).toMatchObject({
      currentModels: 1,
      maxModels: 1,
      operation: 'model_creation',
    })
    expect(mockPrismaUserModelCreate).not.toHaveBeenCalled()
  })

  it('should allow model creation when user has available model slots', async () => {
    // Arrange
    mockAuth.mockResolvedValue({ user: { id: 'user123' } })
    mockCheckUsageLimits.mockResolvedValue({
      maxCreditsPerMonth: 1000,
      maxModels: 5,
      currentCredits: 500,
      currentModels: 2, // Under limit
      canCreateModel: true, // Can create more models
      canGenerateImage: true,
      warningThreshold: 100,
      isNearLimit: false,
    })

    mockPrismaUserModelCreate.mockResolvedValue({
      id: 'model123',
      name: 'Test Model',
      status: 'pending',
      userId: 'user123',
      triggerWord: 'test_model',
      createdAt: new Date(),
    })

    const request = new Request('http://localhost:3000/api/models/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Model',
        skipTraining: true,
      })
    })

    // Act
    const response = await POST(request)
    const responseBody = await response.json()

    // Assert
    expect(response.status).toBe(201)
    expect(responseBody.success).toBe(true)
    expect(responseBody.model.name).toBe('Test Model')
    expect(mockCheckUsageLimits).toHaveBeenCalledWith('user123')
    expect(mockPrismaUserModelCreate).toHaveBeenCalled()
  })

  it('should provide helpful error message for free users', async () => {
    // Arrange
    mockAuth.mockResolvedValue({ user: { id: 'user123' } })
    mockCheckUsageLimits.mockResolvedValue({
      maxCreditsPerMonth: 0,
      maxModels: 0, // Free tier has no models
      currentCredits: 10,
      currentModels: 0,
      canCreateModel: false,
      canGenerateImage: true,
      warningThreshold: 0,
      isNearLimit: false,
    })

    const request = new Request('http://localhost:3000/api/models/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Model',
        skipTraining: true,
      })
    })

    // Act
    const response = await POST(request)
    const responseBody = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(responseBody.error).toBe('Model limit reached')
    expect(responseBody.details.suggestion).toContain('Upgrade your plan to create custom models')
  })

  it('should handle authentication errors', async () => {
    // Arrange
    mockAuth.mockResolvedValue(null) // No session

    const request = new Request('http://localhost:3000/api/models/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Model',
        skipTraining: true,
      })
    })

    // Act
    const response = await POST(request)
    const responseBody = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(responseBody.error).toBe('Unauthorized')
    expect(mockCheckUsageLimits).not.toHaveBeenCalled()
  })
}) 