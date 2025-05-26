import { getProxiedImageUrl } from '@/lib/image-utils'

// Mock window.location for tests if any function relies on it, otherwise not needed.
// Object.defineProperty(window, 'location', {
//   value: {
//     origin: 'http://localhost:3000'
//   },
//   writable: true
// })

describe('image-utils', () => {
  describe('getProxiedImageUrl', () => {
    it('should return the original URL for external URLs', () => {
      const externalUrl = 'https://api.together.xyz/image.jpg'
      const resultUrl = getProxiedImageUrl(externalUrl)
      expect(resultUrl).toBe(externalUrl)
    })

    it('should return the original URL for local URLs', () => {
      const localUrl = '/api/uploads/user123/image.jpg'
      const result = getProxiedImageUrl(localUrl)
      expect(result).toBe(localUrl)
    })

    it('should return the original URL for upload URLs', () => {
      const uploadUrl = '/uploads/user123/image.jpg'
      const result = getProxiedImageUrl(uploadUrl)
      expect(result).toBe(uploadUrl)
    })

    it('should handle URLs with special characters by returning them as is', () => {
      const externalUrl = 'https://api.together.xyz/image with spaces.jpg'
      const resultUrl = getProxiedImageUrl(externalUrl)
      expect(resultUrl).toBe(externalUrl)
    })
  })
}) 