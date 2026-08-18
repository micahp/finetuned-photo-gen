import { fal } from '@fal-ai/client'
import { logOnce } from './log-once'

interface FalImageEditParams {
  prompt: string
  imageUrl: string // fal.ai expects a URL, not a data URI
}

interface FalImageEditResponse {
  images: Array<{
    url: string
    width: number
    height: number
  }>
  description: string // Capture the text response from Gemini
}

interface FalGenerateParams {
  prompt: string
  model?: string // App model id, e.g. 'black-forest-labs/FLUX.1-schnell-Free'
  aspectRatio?: string
  steps?: number
  seed?: number
}

interface FalGenerateResponse {
  status: 'completed' | 'failed'
  images?: Array<{
    url: string
    width: number
    height: number
  }>
  error?: string
}

// Map app model ids to FAL endpoints (Together AI provider is retired — keys rotated)
const FAL_MODEL_MAP: Record<string, string> = {
  'black-forest-labs/FLUX.1-schnell-Free': 'fal-ai/flux/schnell',
  'black-forest-labs/FLUX.1-schnell': 'fal-ai/flux/schnell',
  'black-forest-labs/FLUX.1-dev': 'fal-ai/flux/dev',
  'fal-ai/flux-2-pro': 'fal-ai/flux-2-pro',
  'fal-ai/flux-2/klein/9b': 'fal-ai/flux-2/klein/9b',
  'openai/gpt-image-2': 'openai/gpt-image-2',
  'openai/gpt-image-2/edit': 'openai/gpt-image-2/edit',
}

const FAL_IMAGE_SIZE_MAP: Record<string, string> = {
  '1:1': 'square_hd',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '3:4': 'portrait_4_3',
  '4:3': 'landscape_4_3',
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

  /**
   * Generate an image via FAL using the same FLUX models the app already offers.
   * Replaces the retired Together AI provider for base FLUX models.
   */
  async generateImage(
    params: FalGenerateParams
  ): Promise<FalGenerateResponse> {
    try {
      const model = params.model || 'black-forest-labs/FLUX.1-schnell-Free'
      const falModelId = FAL_MODEL_MAP[model]
      if (!falModelId) {
        return {
          status: 'failed',
          error: `No FAL endpoint mapped for model ${model}`,
        }
      }

      const aspectRatio = params.aspectRatio || '1:1'
      const imageSize =
        FAL_IMAGE_SIZE_MAP[aspectRatio] || FAL_IMAGE_SIZE_MAP['1:1']
      const steps =
        params.steps || (falModelId.includes('dev') ? 10 : 4)

      console.log('🎨 Generating with FAL:', {
        appModel: model,
        falModelId,
        aspectRatio,
        imageSize,
        steps,
      })

      const result = await fal.run(falModelId, {
        input: {
          prompt: params.prompt,
          num_images: 1,
          image_size: imageSize,
          num_inference_steps: steps,
          enable_safety_checker: false,
          seed: params.seed,
        },
      })

      if (!result || !result.data || !result.data.images || result.data.images.length === 0) {
        console.error('❌ FAL - No images in response', { result })
        return {
          status: 'failed',
          error: 'Image generation failed or returned no images.',
        }
      }

      return {
        status: 'completed',
        images: result.data.images.map((img: { url: string; width?: number; height?: number }) => ({
          url: img.url,
          width: img.width || 1024,
          height: img.height || 1024,
        })),
      }
    } catch (error) {
      console.error('❌ FAL image generation error:', error)
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  async editImage(
    params: FalImageEditParams
  ): Promise<{ 
    status: 'completed' | 'failed'; 
    images?: FalImageEditResponse['images']; 
    description?: string;
    error?: string 
  }> {
    try {
      // The `fal.run` method is asynchronous but does not require polling;
      // the client library handles waiting for the result.
      const result = await fal.run('fal-ai/gemini-25-flash-image/edit', {
        input: {
          prompt: params.prompt,
          image_urls: [params.imageUrl], // API expects an array of URLs
        },
      })

      if (!result || !result.data || !result.data.images || result.data.images.length === 0) {
        console.error('❌ Fal.ai - No images in response', { result })
        throw new Error('Image generation failed or returned no images.')
      }

      return {
        status: 'completed',
        images: result.data.images,
        description: result.data.description, // Return the description
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
