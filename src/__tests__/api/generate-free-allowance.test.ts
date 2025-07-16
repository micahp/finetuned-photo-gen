/**
 * @jest-environment node
 */

// Mock NextAuth (unique variable names to avoid collisions across test files)
const mockAuthFree = jest.fn()
jest.mock('@/lib/next-auth', () => ({
  auth: mockAuthFree,
}))

// Mock free-generation helper to always allow
const mockTryConsumeFree = jest.fn()
jest.mock('@/lib/free-generation', () => ({
  tryConsumeDailyFreeGeneration: mockTryConsumeFree,
}))

// Mock CreditService – ensure spendCredits is NOT called on free generation
const mockSpendCreditsFree = jest.fn()
jest.mock('@/lib/credit-service', () => ({
  CreditService: {
    spendCredits: mockSpendCreditsFree,
  },
}))

// Mock watermark application so we can detect invocation
const mockApplyWatermarkFree = jest.fn().mockImplementation(async (buf: Buffer) => buf)
jest.mock('@/lib/watermark', () => ({
  applyWatermark: mockApplyWatermarkFree,
}))

// Mock ImageProcessingService
const mockProcessImageFree = jest.fn()
jest.mock('@/lib/image-processing-service', () => ({
  ImageProcessingService: {
    processImageFromUrl: mockProcessImageFree,
    getOptimalOptions: jest.fn().mockReturnValue({}),
  },
}))

// Mock CloudflareImagesService
const mockUploadImageBufferFree = jest.fn()
const mockGetPublicUrlFree = jest.fn().mockReturnValue('https://cf-images/test')
jest.mock('@/lib/cloudflare-images-service', () => ({
  CloudflareImagesService: jest.fn().mockImplementation(() => ({
    uploadImageFromBuffer: mockUploadImageBufferFree,
    getPublicUrl: mockGetPublicUrlFree,
  })),
}))

// Mock TogetherAI generateImage
const mockGenerateImageFree = jest.fn()
jest.mock('@/lib/together-ai', () => ({
  TogetherAIService: jest.fn().mockImplementation(() => ({
    generateImage: mockGenerateImageFree,
    getStylePresets: jest.fn().mockReturnValue([]),
    getAvailableModels: jest.fn().mockReturnValue([
      { id: 'black-forest-labs/FLUX.1-schnell-Free', provider: 'together' },
    ]),
  })),
}))

// Mock Prisma
const mockUserFindUniqueFree = jest.fn()
const mockPrismaTransactionFree = jest.fn().mockImplementation(async (cb) => cb({}))
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUniqueFree,
      update: jest.fn(),
    },
    $transaction: mockPrismaTransactionFree,
  },
}))

// Test suite

describe('Free model generation – allowance & watermark', () => {
  let POST: any

  beforeAll(async () => {
    const mod = await import('@/app/api/generate/route')
    POST = mod.POST
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Authenticated user
    mockAuthFree.mockResolvedValue({ user: { id: 'user-123' } })

    // User has credits but using free model
    mockUserFindUniqueFree.mockResolvedValue({
      credits: 50,
      subscriptionPlan: 'free',
      subscriptionStatus: null,
      dailyFreeGenerations: 0,
      lastFreeGenerationDate: new Date(),
    })

    // Daily allowance available
    mockTryConsumeFree.mockResolvedValue(true)

    // TogetherAI generate returns success with one image
    mockGenerateImageFree.mockResolvedValue({
      status: 'completed',
      images: [{ url: 'https://example.com/generated.jpg', width: 512, height: 512 }],
    })

    // Image processing returns buffer
    mockProcessImageFree.mockResolvedValue({
      success: true,
      buffer: Buffer.from('image'),
      width: 512,
      height: 512,
      originalSize: 1000,
      compressedSize: 800,
    })

    // Cloudflare upload success
    mockUploadImageBufferFree.mockResolvedValue({ success: true, imageId: 'cf-id' })
  })

  it('should not spend credits and should apply watermark when free allowance is consumed', async () => {
    const request = new Request('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'A test image',
        modelId: 'black-forest-labs/FLUX.1-schnell-Free',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockSpendCreditsFree).not.toHaveBeenCalled()
    expect(mockApplyWatermarkFree).toHaveBeenCalled()
  })
}) 