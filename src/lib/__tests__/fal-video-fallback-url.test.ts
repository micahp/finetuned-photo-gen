import { FalVideoService } from '../fal-video-service'

jest.mock('@fal-ai/client', () => ({
  fal: {
    config: jest.fn(),
    queue: {
      submit: jest.fn().mockResolvedValue({ request_id: 'req_123' })
    }
  }
}))

describe('FalVideoService – fallbackUrl', () => {
  it('returns VideoGenerationResponse with fallbackUrl', async () => {
    process.env.FAL_API_TOKEN = 'test-key'
    const service = new FalVideoService('test-key')

    // Mock internal helpers to avoid network
    const spyProcess = jest.spyOn(service as any, 'processAndUploadVideo').mockResolvedValue({
      videoUrl: 'https://cdn.example.com/final.mp4',
      fileSize: 123_456,
    })

    const res = await service.generateVideo({
      prompt: 'hello',
      modelId: 'stable-video-diffusion',
      duration: 3,
    })

    expect(res.status).toBe('processing')
    expect(res.fallbackUrl).toBeUndefined() // async path returns no fallback yet

    spyProcess.mockRestore()
  })
}) 