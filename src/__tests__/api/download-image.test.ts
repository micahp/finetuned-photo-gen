/**
 * @jest-environment node
 */

// Mock fetch before any imports
global.fetch = jest.fn()

// Mock NextAuth using the ESM-compatible approach
const mockAuth = jest.fn()
jest.mock('@/lib/next-auth', () => ({
  auth: mockAuth,
}))

describe('/api/download-image', () => {
  // Import the handler after mocks are set up
  let GET: any
  
  beforeAll(async () => {
    // Dynamic import to ensure mocks are applied first
    const module = await import('@/app/api/download-image/route')
    GET = module.GET
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET - Authentication Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      mockAuth.mockResolvedValue(null)
      const request = new Request('http://localhost:3000/api/download-image?url=https://example.com/test.jpg')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should return 401 when session exists but user.id is missing', async () => {
      // Arrange
      mockAuth.mockResolvedValue({ 
        user: { id: undefined } 
      })
      const request = new Request('http://localhost:3000/api/download-image?url=https://example.com/test.jpg')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('GET - Input Validation', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
    })

    it('should return 400 when image URL is missing', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/download-image')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Image URL is required')
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should return 400 when image URL is empty', async () => {
      // Arrange
      const request = new Request('http://localhost:3000/api/download-image?url=')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Image URL is required')
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('GET - Successful Image Download', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
    })

    it('should successfully download and proxy image with default filename', async () => {
      // Arrange
      const imageBuffer = Buffer.from('fake-image-data', 'utf-8')
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(imageBuffer.buffer),
        headers: new Map([['content-type', 'image/jpeg']]),
      } as any)

      const request = new Request('http://localhost:3000/api/download-image?url=https://example.com/sunset.jpg')

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('image/jpeg')
      expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="generated-image.png"')
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000')
      
      // Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/sunset.jpg')
    })

    it('should use custom filename when provided', async () => {
      // Arrange
      const imageBuffer = Buffer.from('fake-image-data', 'utf-8')
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(imageBuffer.buffer),
        headers: new Map([['content-type', 'image/png']]),
      } as any)

      const request = new Request('http://localhost:3000/api/download-image?url=https://example.com/test.png&filename=my-awesome-image.png')

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('image/png')
      expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="my-awesome-image.png"')
    })

    it('should fallback to default content-type when not provided', async () => {
      // Arrange
      const imageBuffer = Buffer.from('fake-image-data', 'utf-8')
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(imageBuffer.buffer),
        headers: new Map(), // No content-type header
      } as any)

      const request = new Request('http://localhost:3000/api/download-image?url=https://example.com/test.jpg')

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('image/png') // Default fallback
    })
  })

  describe('GET - Error Handling', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
    })

    it('should return 500 when external image fetch fails', async () => {
      // Arrange
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as any)

      const request = new Request('http://localhost:3000/api/download-image?url=https://example.com/nonexistent.jpg')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch image')
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/nonexistent.jpg')
    })

    it('should return 500 when fetch throws an error', async () => {
      // Arrange
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      
      mockFetch.mockRejectedValue(new Error('Network error'))

      const request = new Request('http://localhost:3000/api/download-image?url=https://example.com/test.jpg')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should return 500 when arrayBuffer() fails', async () => {
      // Arrange
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.reject(new Error('Buffer error')),
        headers: new Map([['content-type', 'image/jpeg']]),
      } as any)

      const request = new Request('http://localhost:3000/api/download-image?url=https://example.com/test.jpg')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('GET - Security Tests', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: 'user-123' } })
    })

    it('should handle potentially malicious URLs gracefully', async () => {
      // Arrange
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
      } as any)

      const request = new Request('http://localhost:3000/api/download-image?url=file:///etc/passwd')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch image')
      expect(mockFetch).toHaveBeenCalledWith('file:///etc/passwd')
    })

    it('should handle special characters in filename parameter', async () => {
      // Arrange
      const imageBuffer = Buffer.from('fake-image-data', 'utf-8')
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
      
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(imageBuffer.buffer),
        headers: new Map([['content-type', 'image/jpeg']]),
      } as any)

      const request = new Request('http://localhost:3000/api/download-image?url=https://example.com/test.jpg&filename=../../../evil.exe')

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
      // Should still use the provided filename (file system protection should be handled by browser/server)
      expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="../../../evil.exe"')
    })
  })
}) 