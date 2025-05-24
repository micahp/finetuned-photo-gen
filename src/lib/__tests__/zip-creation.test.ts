import { ZipCreationService } from '../zip-creation-service'

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
          setTimeout(() => callback(), 10) // Immediate callback
        }
      })
    }
    return mockStream
  }),
  statSync: jest.fn().mockReturnValue({ size: 1024 }),
  rmSync: jest.fn()
}))

// Mock archiver
jest.mock('archiver', () => {
  return jest.fn().mockImplementation(() => {
    const mockArchiver = {
      pipe: jest.fn(),
      file: jest.fn(),
      finalize: jest.fn(() => {
        // Trigger close event immediately
        setTimeout(() => {
          const fs = require('fs')
          const stream = fs.createWriteStream()
          stream.on('close', () => {})()
        }, 10)
      }),
      pointer: jest.fn().mockReturnValue(2048),
      on: jest.fn()
    }
    return mockArchiver
  })
})

// Mock fetch
global.fetch = jest.fn()

describe('ZipCreationService', () => {
  let zipService: ZipCreationService

  beforeEach(() => {
    zipService = new ZipCreationService('test-training-123')
    jest.clearAllMocks()
    
    // Mock successful fetch by default
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    })
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
    expect(result.debugData.currentStage).toBe('zip_creation')
  }, 15000)

  it('should handle image download failures gracefully with proper error categorization', async () => {
    // Mock fetch failure
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    const trainingImages = [
      { id: '1', filename: 'broken.jpg', url: 'https://invalid-url.com/broken.jpg', size: 1024 }
    ]

    const result = await zipService.createTrainingZip(trainingImages)

    expect(result.success).toBe(false)
    expect(result.error).toContain('No valid images could be processed')
    expect(result.debugData).toBeDefined()
    expect(result.debugData.totalErrors).toBeGreaterThan(0)
    expect(result.debugData.lastError?.category).toBe('network')
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
    expect(result.error).toContain('No valid images could be processed')
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
}) 