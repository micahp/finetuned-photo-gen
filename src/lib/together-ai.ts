import { TogetherGenerationResponse, TogetherModelResponse } from '@/lib/types'

interface GenerateImageParams {
  prompt: string
  model?: string
  width?: number
  height?: number
  steps?: number
  seed?: number
  aspectRatio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3'
}

interface GenerateImageResponse {
  id: string
  status: 'processing' | 'completed' | 'failed'
  images?: Array<{
    url: string
    width: number
    height: number
  }>
  error?: string
}

export class TogetherAIService {
  private apiKey: string
  private baseUrl = 'https://api.together.xyz/v1'

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TOGETHER_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('Together AI API key is required')
    }
  }

  // Get dimensions from aspect ratio
  private getDimensions(aspectRatio: string = '1:1'): { width: number; height: number } {
    const ratios = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1344, height: 768 },
      '9:16': { width: 768, height: 1344 },
      '3:4': { width: 768, height: 1024 },
      '4:3': { width: 1024, height: 768 }
    }
    return ratios[aspectRatio as keyof typeof ratios] || ratios['1:1']
  }

  // Generate image using FLUX models
  async generateImage(params: GenerateImageParams): Promise<GenerateImageResponse> {
    try {
      const { width, height } = this.getDimensions(params.aspectRatio)
      
      const requestBody = {
        prompt: params.prompt,
        model: params.model || 'black-forest-labs/FLUX.1-schnell-Free', // Free model for testing
        width: params.width || width,
        height: params.height || height,
        steps: params.steps || 3, // Fast generation for testing
        seed: params.seed,
        n: 1,
        response_format: 'url'
      }

      const response = await fetch(`${this.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `API request failed: ${response.status}`)
      }

      const data = await response.json()
      
      // Together AI returns images directly, not as a job
      return {
        id: data.id || `img_${Date.now()}`,
        status: 'completed',
        images: data.data.map((img: any) => ({
          url: img.url,
          width: requestBody.width,
          height: requestBody.height,
        }))
      }

    } catch (error) {
      console.error('Together AI generation error:', error)
      return {
        id: `err_${Date.now()}`,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  // Get available FLUX models
  getAvailableModels(): Array<{ id: string; name: string; description: string; free?: boolean }> {
    return [
      {
        id: 'black-forest-labs/FLUX.1-schnell-Free',
        name: 'FLUX.1 Schnell (Free)',
        description: 'Fast, free FLUX model - perfect for testing',
        free: true
      },
      {
        id: 'black-forest-labs/FLUX.1-schnell',
        name: 'FLUX.1 Schnell (Turbo)',
        description: 'Ultra-fast FLUX model with superior performance'
      },
      {
        id: 'black-forest-labs/FLUX.1-dev',
        name: 'FLUX.1 Dev',
        description: 'Higher quality FLUX model for better results'
      },
      {
        id: 'black-forest-labs/FLUX.1-pro',
        name: 'FLUX.1 Pro',
        description: 'Premium FLUX model for highest quality'
      },
      {
        id: 'black-forest-labs/FLUX1.1-pro',
        name: 'FLUX 1.1 Pro',
        description: 'Latest premium model with 3x faster generation'
      }
    ]
  }

  // Get style presets
  getStylePresets(): Array<{ id: string; name: string; prompt: string }> {
    return [
      { id: 'none', name: 'None', prompt: '' },
      { id: 'photorealistic', name: 'Photorealistic', prompt: 'photorealistic, high quality, detailed' },
      { id: 'cinematic', name: 'Cinematic', prompt: 'cinematic lighting, dramatic, film still' },
      { id: 'portrait', name: 'Portrait', prompt: 'professional portrait, studio lighting' },
      { id: 'artistic', name: 'Artistic', prompt: 'artistic, creative, stylized' },
      { id: 'digital_art', name: 'Digital Art', prompt: 'digital art, illustration, concept art' },
      { id: 'vintage', name: 'Vintage', prompt: 'vintage style, retro, classic' },
      { id: 'minimalist', name: 'Minimalist', prompt: 'minimalist, clean, simple' }
    ]
  }

  // Get prompt suggestions
  getPromptSuggestions(): string[] {
    return [
      'A professional headshot of a person',
      'A person in a modern office setting',
      'A casual portrait outdoors',
      'A person reading a book in a cozy cafe',
      'A business professional giving a presentation',
      'A person working on a laptop in a park',
      'A chef cooking in a modern kitchen',
      'A person exercising in a gym',
      'A traveler exploring a new city',
      'A student studying in a library'
    ]
  }
} 