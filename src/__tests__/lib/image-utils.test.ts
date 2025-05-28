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
    it('should proxy external URLs through the image proxy', () => {
      const externalUrl = 'https://api.together.xyz/image.jpg'
      const resultUrl = getProxiedImageUrl(externalUrl)
      expect(resultUrl).toBe('/api/image-proxy?url=https%3A%2F%2Fapi.together.xyz%2Fimage.jpg')
    })

    it('should return the original URL for local API URLs', () => {
      const localUrl = '/api/uploads/user123/image.jpg'
      const result = getProxiedImageUrl(localUrl)
      expect(result).toBe(localUrl)
    })

    it('should return the original URL for upload URLs', () => {
      const uploadUrl = '/uploads/user123/image.jpg'
      const result = getProxiedImageUrl(uploadUrl)
      expect(result).toBe(uploadUrl)
    })

    it('should proxy external URLs with special characters', () => {
      const externalUrl = 'https://api.together.xyz/image with spaces.jpg'
      const resultUrl = getProxiedImageUrl(externalUrl)
      expect(resultUrl).toBe('/api/image-proxy?url=https%3A%2F%2Fapi.together.xyz%2Fimage%20with%20spaces.jpg')
    })
  })
}) 