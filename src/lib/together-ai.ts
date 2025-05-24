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

  // Get categorized prompt suggestions
  getCategorizedPrompts(): Record<string, Array<{ prompt: string; description: string }>> {
    return {
      'Dating Apps': [
        { prompt: 'A genuine smile portrait with natural lighting, authentic and approachable', description: 'Perfect for Tinder, Bumble, Hinge' },
        { prompt: 'Casual outdoor portrait, relaxed pose, warm golden hour lighting', description: 'Shows personality and authenticity' },
        { prompt: 'A person enjoying their hobby, genuine happiness, lifestyle portrait', description: 'Conversation starter photo' },
        { prompt: 'Beach portrait, casual attire, natural smile, sunset lighting', description: 'Fun and adventurous vibe' },
        { prompt: 'Coffee shop portrait, reading or working, cozy atmosphere', description: 'Intellectual and approachable' },
        { prompt: 'Hiking or outdoor adventure portrait, natural background', description: 'Active lifestyle showcase' },
        { prompt: 'Pet lover portrait with dog or cat, genuine interaction', description: 'Shows caring personality' },
        { prompt: 'Travel photo at famous landmark, happy expression', description: 'Worldly and adventurous' }
      ],
      'Professional Headshots': [
        { prompt: 'Executive business headshot, confident expression, professional lighting', description: 'CEO and leadership roles' },
        { prompt: 'LinkedIn professional headshot, approachable smile, business attire', description: 'Networking and career growth' },
        { prompt: 'Lawyer professional headshot, trustworthy expression, formal attire', description: 'Legal profession' },
        { prompt: 'Doctor medical professional headshot, competent and caring', description: 'Healthcare industry' },
        { prompt: 'Tech professional headshot, modern office background, casual business', description: 'Startup and tech industry' },
        { prompt: 'Consultant headshot, confident and approachable, clean background', description: 'Business consulting' },
        { prompt: 'Real estate agent headshot, friendly and trustworthy smile', description: 'Real estate industry' },
        { prompt: 'Teacher or educator headshot, warm and approachable expression', description: 'Education sector' }
      ],
      'Lifestyle & Social': [
        { prompt: 'Instagram influencer photo, stylish outfit, trendy location', description: 'Social media content' },
        { prompt: 'Fitness influencer workout photo, athletic wear, gym setting', description: 'Health and wellness content' },
        { prompt: 'Food blogger photo, enjoying a meal, restaurant setting', description: 'Culinary content creation' },
        { prompt: 'Fashion portrait, stylish outfit, urban background', description: 'Style and fashion content' },
        { prompt: 'Cozy home lifestyle photo, comfortable and relaxed', description: 'Lifestyle blogging' },
        { prompt: 'Book lover portrait, reading in beautiful location', description: 'Literary and intellectual content' },
        { prompt: 'Art creator portrait, in studio with artwork', description: 'Creative and artistic content' },
        { prompt: 'Music lover photo, with instrument or at concert', description: 'Music and entertainment content' }
      ],
      'Creative & Artistic': [
        { prompt: 'Artistic portrait with dramatic lighting, creative composition', description: 'Fine art photography style' },
        { prompt: 'Vintage aesthetic portrait, retro styling and colors', description: '1950s-1980s inspired looks' },
        { prompt: 'Film noir portrait, black and white, dramatic shadows', description: 'Classic Hollywood glamour' },
        { prompt: 'Cyberpunk aesthetic portrait, neon lighting, futuristic', description: 'Sci-fi and tech aesthetic' },
        { prompt: 'Bohemian portrait, natural setting, flowing fabrics', description: 'Free-spirited artistic vibe' },
        { prompt: 'Minimalist portrait, clean composition, simple background', description: 'Modern and sophisticated' },
        { prompt: 'Gothic portrait, dark romantic aesthetic, dramatic makeup', description: 'Alternative and edgy style' },
        { prompt: 'Ethereal fantasy portrait, magical lighting effects', description: 'Dreamy and otherworldly' }
      ],
      'Luxury & Glamour': [
        { prompt: 'Luxury lifestyle photo, expensive car, sophisticated pose', description: 'High-end lifestyle content' },
        { prompt: 'Red carpet glamour portrait, elegant gown, professional makeup', description: 'Celebrity-style photos' },
        { prompt: 'Private jet or yacht photo, luxury travel lifestyle', description: 'Elite lifestyle showcase' },
        { prompt: 'Designer fashion portrait, luxury boutique setting', description: 'High fashion and luxury brands' },
        { prompt: 'Five-star hotel lifestyle photo, elegant and refined', description: 'Luxury hospitality content' },
        { prompt: 'Champagne and celebration photo, elegant party setting', description: 'Celebratory luxury moments' },
        { prompt: 'High-end jewelry portrait, elegant accessories focus', description: 'Luxury accessories showcase' },
        { prompt: 'Penthouse lifestyle photo, city skyline background', description: 'Urban luxury living' }
      ],
      'Seasonal & Occasions': [
        { prompt: 'Holiday family portrait, warm lighting, festive atmosphere', description: 'Christmas and holiday cards' },
        { prompt: 'Wedding portrait, elegant dress, romantic lighting', description: 'Bridal and wedding content' },
        { prompt: 'Graduation portrait, cap and gown, proud expression', description: 'Academic achievements' },
        { prompt: 'Birthday celebration photo, party atmosphere, joyful', description: 'Special occasion memories' },
        { prompt: 'Summer vacation photo, beach or pool setting, relaxed', description: 'Seasonal lifestyle content' },
        { prompt: 'Autumn portrait, fall colors, cozy sweater', description: 'Seasonal fashion and mood' },
        { prompt: 'Spring garden portrait, flowers, fresh and bright', description: 'Nature and renewal themes' },
        { prompt: 'Winter snow portrait, warm clothing, magical atmosphere', description: 'Winter wonderland vibes' }
      ]
    }
  }

  // Get quick prompt templates
  getQuickPrompts(): Array<{ label: string; prompt: string; emoji: string }> {
    return [
      { label: 'Professional Headshot', prompt: 'Professional business headshot, confident smile, clean background, studio lighting', emoji: '💼' },
      { label: 'Dating Profile', prompt: 'Authentic portrait, genuine smile, natural lighting, approachable and friendly', emoji: '💖' },
      { label: 'Instagram Ready', prompt: 'Instagram-worthy photo, trendy outfit, stylish location, perfect lighting', emoji: '📸' },
      { label: 'Casual Portrait', prompt: 'Casual lifestyle portrait, relaxed pose, natural setting, warm lighting', emoji: '😊' },
      { label: 'Fitness Photo', prompt: 'Fitness lifestyle photo, athletic wear, gym or outdoor setting, energetic pose', emoji: '💪' },
      { label: 'Creative Portrait', prompt: 'Artistic portrait, creative lighting, unique composition, dramatic shadows', emoji: '🎨' },
      { label: 'Travel Vibes', prompt: 'Travel portrait, exotic location, adventure outfit, wanderlust atmosphere', emoji: '✈️' },
      { label: 'Luxury Lifestyle', prompt: 'Luxury lifestyle photo, elegant setting, sophisticated pose, high-end aesthetic', emoji: '💎' }
    ]
  }
} 