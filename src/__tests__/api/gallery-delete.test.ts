/**
 * @jest-environment node
 */

// Mock auth helper
const mockAuthFn = jest.fn()
jest.mock('@/lib/next-auth', () => ({
  auth: mockAuthFn,
}))

// Mock Prisma client
const mockFindUnique = jest.fn()
const mockDelete = jest.fn()
jest.mock('@/lib/db', () => ({
  prisma: {
    generatedImage: {
      findUnique: mockFindUnique,
      delete: mockDelete,
    },
  },
}))

// Mock Cloudflare service
const mockCfDelete = jest.fn()
jest.mock('@/lib/cloudflare-images-service', () => ({
  CloudflareImagesService: jest.fn().mockImplementation(() => ({
    deleteImage: mockCfDelete,
  })),
}))

describe('DELETE /api/gallery/[id]', () => {
  let DELETE: any

  beforeAll(async () => {
    const mod = await import('@/app/api/gallery/[id]/route')
    DELETE = mod.DELETE
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockAuthFn.mockResolvedValue(null)
    const req = new Request('http://localhost:3000/api/gallery/abc', { method: 'DELETE' })
    const res = await DELETE(req, { params: { id: 'abc' } })
    expect(res.status).toBe(401)
  })

  it('returns 403 when user does not own image', async () => {
    mockAuthFn.mockResolvedValue({ user: { id: 'user-1' } })
    mockFindUnique.mockResolvedValue({ id: 'abc', userId: 'different-user' })

    const req = new Request('http://localhost:3000/api/gallery/abc', { method: 'DELETE' })
    const res = await DELETE(req, { params: { id: 'abc' } })
    expect(res.status).toBe(403)
  })

  it('deletes image and returns success', async () => {
    mockAuthFn.mockResolvedValue({ user: { id: 'user-1' } })
    mockFindUnique.mockResolvedValue({ id: 'abc', userId: 'user-1', cloudflareImageId: 'cf-123' })
    mockDelete.mockResolvedValue({})
    mockCfDelete.mockResolvedValue(true)

    const req = new Request('http://localhost:3000/api/gallery/abc', { method: 'DELETE' })
    const res = await DELETE(req, { params: { id: 'abc' } })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'abc' } })
    expect(mockCfDelete).toHaveBeenCalledWith('cf-123')
  })
}) 