import { validateUploadedImages, saveImageToLocal } from '@/lib/upload'

// Mock File constructor that works with Jest
class MockFile extends File {
  constructor(content: string[], filename: string, options: FilePropertyBag = {}) {
    super(content, filename, options)
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(this.size))
  }
}

describe('File Upload System', () => {
  describe('validateUploadedImages', () => {
    it('should validate image format and size', () => {
      const validImage = {
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 1024 * 1024, // 1MB
      } as File

      const result = validateUploadedImages([validImage])
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid image formats', () => {
      const invalidImage = {
        name: 'test.txt',
        type: 'text/plain',
        size: 1024,
      } as File

      const result = validateUploadedImages([invalidImage])
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid file format: test.txt. Only JPEG, PNG, and WebP are allowed.')
    })

    it('should reject images that are too large', () => {
      const largeImage = {
        name: 'large.jpg',
        type: 'image/jpeg',
        size: 15 * 1024 * 1024, // 15MB - exceeds 10MB limit
      } as File

      const result = validateUploadedImages([largeImage])
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('File too large: large.jpg. Maximum size is 10MB.')
    })

    it('should reject too many images', () => {
      const images = Array.from({ length: 21 }, (_, i) => ({
        name: `image${i}.jpg`,
        type: 'image/jpeg',
        size: 1024 * 1024,
      })) as File[]

      const result = validateUploadedImages(images)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Too many files. Maximum 20 images allowed.')
    })
  })

  describe('saveImageToLocal', () => {
    it('should save image to local storage and return file path', async () => {
      const mockImage = new MockFile(['mock image data'], 'test.jpg', { type: 'image/jpeg' })
      const userId = 'user123'
      
      const result = await saveImageToLocal(mockImage, userId)
      
      expect(result.success).toBe(true)
      expect(result.filePath).toMatch(/^\/uploads\/user123\/\d+_test\.jpg$/)
      expect(result.error).toBeUndefined()
    })

    it('should handle save errors gracefully', async () => {
      const mockImage = new MockFile([''], '', { type: 'invalid' })
      const userId = 'user123'
      
      const result = await saveImageToLocal(mockImage, userId)
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.filePath).toBeUndefined()
    })
  })
}) 