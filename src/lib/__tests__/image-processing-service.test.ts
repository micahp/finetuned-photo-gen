import { ImageProcessingService } from '../image-processing-service'

// Mock sharp - define the mock first
const mockMetadata = {
  format: 'jpeg',
  width: 1024,
  height: 1024
}

const mockSharpInstance = {
  metadata: jest.fn().mockResolvedValue(mockMetadata),
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  png: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('processed image'))
}

jest.mock('sharp', () => jest.fn(() => mockSharpInstance))

// Mock fetch
global.fetch = jest.fn()

describe('ImageProcessingService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('processed image'))
  })

  describe('processImageFromUrl', () => {
    it('should successfully process an image under size limit', async () => {
      const mockImageBuffer = Buffer.from('mock image data')
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockImageBuffer.buffer)
      }
      
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await ImageProcessingService.processImageFromUrl(
        'https://example.com/image.jpg'
      )

      expect(result.success).toBe(true)
      expect(result.buffer).toBeDefined()
      expect(result.compressedSize).toBeDefined()
      expect(fetch).toHaveBeenCalledWith('https://example.com/image.jpg')
    })

    it('should handle download failure', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }
      
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await ImageProcessingService.processImageFromUrl(
        'https://example.com/nonexistent.jpg'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to download image: 404 Not Found')
    })

    it('should process large images with multiple quality attempts', async () => {
      const mockImageBuffer = Buffer.alloc(25 * 1024 * 1024) // 25MB
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockImageBuffer.buffer)
      }
      
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)
      
      // First attempts return large buffers, final attempt returns smaller
      mockSharpInstance.toBuffer
        .mockResolvedValueOnce(Buffer.alloc(20 * 1024 * 1024)) // Still too large
        .mockResolvedValueOnce(Buffer.alloc(15 * 1024 * 1024)) // Acceptable

      const result = await ImageProcessingService.processImageFromUrl(
        'https://example.com/large-image.jpg'
      )

      expect(result.success).toBe(true)
      expect(mockSharpInstance.jpeg).toHaveBeenCalledTimes(2) // Multiple attempts
    })

    it('should use optimal options based on image size', () => {
      const largeImageOptions = ImageProcessingService.getOptimalOptions(
        60 * 1024 * 1024, // 60MB - should be 70 quality
        3000,
        3000
      )

      expect(largeImageOptions.quality).toBe(70) // Lower quality for very large images
      expect(largeImageOptions.maxWidth).toBe(2048)
      expect(largeImageOptions.maxHeight).toBe(2048)

      const mediumImageOptions = ImageProcessingService.getOptimalOptions(
        30 * 1024 * 1024, // 30MB - should be 75 quality
        2000,
        2000
      )

      expect(mediumImageOptions.quality).toBe(75) // Medium quality for large images

      const smallImageOptions = ImageProcessingService.getOptimalOptions(
        2 * 1024 * 1024, // 2MB - should be 85 quality
        1024,
        1024
      )

      expect(smallImageOptions.quality).toBe(85) // Higher quality for smaller images
    })

    it('should handle processing errors gracefully', async () => {
      const mockImageBuffer = Buffer.from('invalid image data')
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockImageBuffer.buffer)
      }
      
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)
      
      mockSharpInstance.metadata.mockRejectedValueOnce(new Error('Invalid image'))

      const result = await ImageProcessingService.processImageFromUrl(
        'https://example.com/invalid.jpg'
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid image')
    })

    it('should respect custom processing options', async () => {
      const mockImageBuffer = Buffer.from('mock image data')
      const mockResponse = {
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockImageBuffer.buffer)
      }
      
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      await ImageProcessingService.processImageFromUrl(
        'https://example.com/image.jpg',
        {
          quality: 95,
          format: 'webp',
          maxWidth: 1024,
          maxHeight: 1024
        }
      )

      expect(mockSharpInstance.webp).toHaveBeenCalledWith({
        quality: 95,
        effort: 6
      })
      expect(mockSharpInstance.resize).toHaveBeenCalledWith({
        width: 1024,
        height: 1024,
        fit: 'inside',
        withoutEnlargement: false
      })
    })
  })
}) 