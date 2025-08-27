import { fal } from '@fal-ai/client'
import { logOnce } from './log-once'

interface FalImageEditParams {
  prompt: string
  imageUrl: string
  seed?: number
}

interface FalImageEditResponse {
  images: Array<{
    url: string
    width: number
    height: number
  }>
}

export class FalImageService {
  constructor(apiKey?: string) {
    const falApiKey = apiKey || process.env.FAL_API_TOKEN || ''
    if (!falApiKey) {
      // eslint-disable-next-line no-console
      console.error(
        'FAL_API_TOKEN missing for FalImageService. Available env vars:',
        Object.keys(process.env).filter((key) =>
          key.toUpperCase().includes('FAL')
        )
      )
      throw new Error(
        'Fal.ai API key is required. Please set FAL_API_TOKEN environment variable.'
      )
    }
    logOnce('boot.fal_token', () => console.log('✅ Fal.ai API token found'))

    fal.config({
      credentials: falApiKey,
    })
  }

  async editImage(
    params: FalImageEditParams
  ): Promise<{ status: 'completed' | 'failed'; images?: FalImageEditResponse['images']; error?: string }> {
    try {
      const result: FalImageEditResponse = await fal.run('fal-ai/gemini-25-flash-image/edit', {
        input: {
          prompt: params.prompt,
          image_urls: [params.imageUrl],
          seed: params.seed,
        },
      })

      if (!result || !result.images || result.images.length === 0) {
        throw new Error('Image generation failed or returned no images.')
      }

      return {
        status: 'completed',
        images: result.images,
      }
    } catch (error) {
      console.error('❌ Fal.ai image edit error:', error)
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }
}
