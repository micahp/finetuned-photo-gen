// Set up AWS environment variables to prevent initialization errors
process.env.AWS_ACCESS_KEY_ID = 'fake-access-key-id'
process.env.AWS_SECRET_ACCESS_KEY = 'fake-secret-access-key'
process.env.AWS_SESSION_TOKEN = 'fake-session-token'
process.env.AWS_REGION = 'us-east-1'

// Mock CloudStorageService before importing ZipCreationService
const mockUploadZipFile = jest.fn()
const mockGetStorageInfo = jest.fn()

jest.mock('../cloud-storage', () => ({
  CloudStorageService: jest.fn().mockImplementation(() => ({
    uploadZipFile: mockUploadZipFile,
    getStorageInfo: mockGetStorageInfo
  }))
}))

// Mock sharp
jest.mock('sharp', () => {
  return jest.fn().mockImplementation(() => ({
    metadata: jest.fn().mockResolvedValue({
      format: 'jpeg',
      width: 1024,
      height: 768
    }),
    jpeg: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-image-data'))
  }))
})

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  createWriteStream: jest.fn().mockImplementation(() => {
    const mockStream = {
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(), 10)
        }
      })
    }
    return mockStream
  }),
  statSync: jest.fn().mockReturnValue({ size: 1024 }),
  rmSync: jest.fn()
}))

// Mock archiver
const mockArchiver = {
  pipe: jest.fn(),
  file: jest.fn(),
  finalize: jest.fn().mockResolvedValue(undefined),
  pointer: jest.fn().mockReturnValue(2048),
  on: jest.fn()
}

jest.mock('archiver', () => jest.fn(() => mockArchiver))

// Mock fetch
global.fetch = jest.fn()

// Import after all mocks are set up
import { ZipCreationService } from '../zip-creation-service'

describe('ZipCreationService', () => {
  let zipService: ZipCreationService

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up default mock behaviors
    mockUploadZipFile.mockResolvedValue({
      success: true,
      url: 'https://storage.example.com/training-images.zip',
      filePath: '/tmp/training-images.zip'
    })
    
    mockGetStorageInfo.mockReturnValue({
      provider: 'local'
    })
    
    // Mock successful fetch by default
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    })
    
    zipService = new ZipCreationService('test-training-123')
  })

  it('should create a ZIP file from training images with debug logging', async () => {
    const trainingImages = [
      { id: '1', filename: 'image1.jpg', url: 'https://example.com/image1.jpg', size: 1024 }
    ]

    const result = await zipService.createTrainingZip(trainingImages)

    expect(result.success).toBe(true)
    expect(result.zipUrl).toMatch(/^https?:\/\//)
    expect(result.totalSize).toBeGreaterThan(0)
    expect(result.imageCount).toBeGreaterThan(0)
    expect(result.debugData).toBeDefined()
    expect(mockUploadZipFile).toHaveBeenCalled()
  }, 15000)

  it('should handle image download failures gracefully with proper error categorization', async () => {
    // Mock fetch failure
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    const trainingImages = [
      { id: '1', filename: 'broken.jpg', url: 'https://invalid-url.com/broken.jpg', size: 1024 }
    ]

    const result = await zipService.createTrainingZip(trainingImages)

    expect(result.success).toBe(false)
    expect(result.error).toContain('ZIP creation failed')
    expect(result.debugData).toBeDefined()
    expect(result.debugData.totalErrors).toBeGreaterThan(0)
  }, 15000)

  it('should validate image formats and provide detailed error messages', async () => {
    // Mock sharp to reject for invalid format
    const mockSharp = require('sharp')
    mockSharp.mockImplementationOnce(() => ({
      metadata: jest.fn().mockRejectedValue(new Error('Invalid image format'))
    }))

    const trainingImages = [
      { id: '1', filename: 'document.pdf', url: 'https://example.com/document.pdf', size: 1024 }
    ]

    const result = await zipService.createTrainingZip(trainingImages)

    expect(result.success).toBe(false)
    expect(result.error).toContain('ZIP creation failed')
    expect(result.debugData?.totalErrors).toBeGreaterThan(0)
  }, 15000)

  it('should provide comprehensive debug information for troubleshooting', async () => {
    const result = await zipService.createTrainingZip([])

    expect(result.success).toBe(false)
    expect(result.debugData).toBeDefined()
    expect(result.debugData.currentStage).toBeDefined()
    expect(result.debugData.stageTimings).toBeDefined()
    expect(result.debugData.recentLogs).toBeDefined()
  })

  it('should handle cloud storage upload failures', async () => {
    // Mock cloud storage failure
    mockUploadZipFile.mockResolvedValue({
      success: false,
      error: 'Storage service unavailable'
    })

    const trainingImages = [
      { id: '1', filename: 'image1.jpg', url: 'https://example.com/image1.jpg', size: 1024 }
    ]

    const result = await zipService.createTrainingZip(trainingImages)

    expect(result.success).toBe(false)
    expect(result.error).toContain('ZIP creation failed')
    expect(mockUploadZipFile).toHaveBeenCalled()
  }, 15000)
}) 