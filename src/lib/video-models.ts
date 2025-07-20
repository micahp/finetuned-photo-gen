export interface VideoModel {
  id: string
  name: string
  /** Underlying Fal.ai model slug */
  falModelId: string
  /** Generation mode supported by the endpoint */
  mode: 'image-to-video' | 'text-to-video'
  /** Maximum clip length (seconds) allowed by the model */
  maxDuration: number
  /** Cost in internal credits per second of generated video */
  costPerSecond: number
  /** Supported output aspect ratios */
  supportedAspectRatios: string[]
  /** Default inference parameters */
  defaultParams: {
    fps: number
    motionLevel: number
  }
  /** Allowed clip durations (seconds) accepted by the underlying API, if restricted */
  durationOptions?: number[]
  /** Whether the model generates video with synchronized audio */
  hasAudio: boolean
}

/**
 * Pricing table for video-generation models based on real Fal.ai endpoints and pricing.
 * 1 credit ≈ $0.01 in our current accounting model.
 * 
 * Real pricing from Fal.ai (updated January 2025):
 * - Kling models: $0.095-$0.28/second (9.5-28 credits/second)
 * - Seedance: Available via ByteDance endpoint
 * - Hailuo: Available via MiniMax endpoint  
 * - Veo 3: Available but pricing varies
 */
export const VIDEO_MODELS: VideoModel[] = [
  /* -------------------------- Seedance 1.0 (ByteDance) -------------------------- */
  {
    id: 'seedance-pro-image',
    name: 'Seedance 1.0 Pro – Image → Video',
    falModelId: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
    mode: 'image-to-video',
    maxDuration: 10,
    costPerSecond: 19, // Fal cost 12.4¢/s, markup ×1.5 → 19 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
    durationOptions: [5, 10],
    hasAudio: false,
  },
  {
    id: 'seedance-pro-text',
    name: 'Seedance 1.0 Pro – Text → Video',
    falModelId: 'fal-ai/bytedance/seedance/v1/pro/text-to-video',
    mode: 'text-to-video',
    maxDuration: 10,
    costPerSecond: 19, // Fal cost 12.4¢/s, markup ×1.5 → 19 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
    durationOptions: [5, 10],
    hasAudio: false,
  },
  {
    id: 'seedance-lite-image',
    name: 'Seedance 1.0 Lite – Image → Video',
    falModelId: 'fal-ai/bytedance/seedance/v1/lite/image-to-video',
    mode: 'image-to-video',
    maxDuration: 10,
    costPerSecond: 7, // Fal cost 3.6¢/s, markup ×2 → 7 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
    durationOptions: [5, 10],
    hasAudio: false,
  },
  {
    id: 'seedance-lite-text',
    name: 'Seedance 1.0 Lite – Text → Video',
    falModelId: 'fal-ai/bytedance/seedance/v1/lite/text-to-video',
    mode: 'text-to-video',
    maxDuration: 10,
    costPerSecond: 7, // Fal cost 3.6¢/s, markup ×2 → 7 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
    durationOptions: [5, 10],
    hasAudio: false,
  },

  /* -------------------------- Hailuo 02 (MiniMax) -------------------------- */
  {
    id: 'hailuo-02-pro-image',
    name: 'Hailuo 02 Pro – Image → Video',
    falModelId: 'fal-ai/minimax/hailuo-02/pro/image-to-video',
    mode: 'image-to-video',
    maxDuration: 15,
    costPerSecond: 14, // Fal cost 8¢/s, markup ×1.75 → 14 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
    durationOptions: [6, 10],
    hasAudio: false,
  },
  {
    id: 'hailuo-02-pro-text',
    name: 'Hailuo 02 Pro – Text → Video',
    falModelId: 'fal-ai/minimax/hailuo-02/pro/text-to-video',
    mode: 'text-to-video',
    maxDuration: 15,
    costPerSecond: 14, // Fal cost 8¢/s, markup ×1.75 → 14 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
    durationOptions: [6, 10],
    hasAudio: false,
  },
  {
    id: 'hailuo-02-standard-image',
    name: 'Hailuo 02 Standard – Image → Video',
    falModelId: 'fal-ai/minimax/hailuo-02/standard/image-to-video',
    mode: 'image-to-video',
    maxDuration: 15,
    costPerSecond: 9, // Fal cost 4.5¢/s, markup ×2 → 9 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
    durationOptions: [6, 10],
    hasAudio: false,
  },
  {
    id: 'hailuo-02-standard-text',
    name: 'Hailuo 02 Standard – Text → Video',
    falModelId: 'fal-ai/minimax/hailuo-02/standard/text-to-video',
    mode: 'text-to-video',
    maxDuration: 15,
    costPerSecond: 9, // Fal cost 4.5¢/s, markup ×2 → 9 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
    durationOptions: [6, 10],
    hasAudio: false,
  },

  /* --------------------------------- Veo 3 --------------------------------- */
  {
    id: 'veo-3-text',
    name: 'Veo 3 – Text → Video',
    falModelId: 'fal-ai/veo3',
    mode: 'text-to-video',
    maxDuration: 8,
    costPerSecond: 94, // Fal cost 75¢/s (audio), markup ×1.25 → 94 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 30,
      motionLevel: 6,
    },
    durationOptions: [5, 6, 7, 8],
    hasAudio: true,
  },

  /* ------------------------------- Veo 3 Fast ------------------------------ */
  {
    id: 'veo-3-fast-text',
    name: 'Veo 3 Fast – Text → Video',
    falModelId: 'fal-ai/veo3-fast',
    mode: 'text-to-video',
    maxDuration: 8,
    costPerSecond: 50, // Fal cost 40¢/s (audio), markup ×1.25 → 50 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 30,
      motionLevel: 6,
    },
    durationOptions: [5, 6, 7, 8],
    hasAudio: true,
  },

  /* -------------------------- Kling 2.1 (Kuaishou) -------------------------- */
  {
    id: 'kling-2.1-master-image',
    name: 'Kling 2.1 Master – Image → Video',
    falModelId: 'fal-ai/kling-video/v2.1/master/image-to-video',
    mode: 'image-to-video',
    maxDuration: 20,
    costPerSecond: 42, // Fal cost 28¢/s, markup ×1.5 → 42 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
    durationOptions: [5, 10],
    hasAudio: false,
  },
  {
    id: 'kling-2.1-pro-image',
    name: 'Kling 2.1 Pro – Image → Video',
    falModelId: 'fal-ai/kling-video/v2.1/pro/image-to-video',
    mode: 'image-to-video',
    maxDuration: 20,
    costPerSecond: 16, // Fal cost 9¢/s, markup ×1.75 → 16 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
    durationOptions: [5, 10],
    hasAudio: false,
  },
  {
    id: 'kling-2.1-standard-image',
    name: 'Kling 2.1 Standard – Image → Video',
    falModelId: 'fal-ai/kling-video/v2.1/standard/image-to-video',
    mode: 'image-to-video',
    maxDuration: 20,
    costPerSecond: 14, // Fal estimated 8¢/s, markup ×1.75 → 14 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
    durationOptions: [5, 10],
    hasAudio: false,
  },

  /* ----------------------------- Additional Models ----------------------------- */
  {
    id: 'veo-2-text',
    name: 'Veo 2 – Text → Video',
    falModelId: 'fal-ai/veo2',
    mode: 'text-to-video',
    maxDuration: 8,
    costPerSecond: 63, // Fal cost 50¢/s, markup ×1.25 ≈ 62.5 → 63 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 30, motionLevel: 6 },
    durationOptions: [5, 6, 7, 8],
    hasAudio: false,
  },

  {
    id: 'kling-2.0-master-image',
    name: 'Kling 2.0 Master – Image → Video',
    falModelId: 'fal-ai/kling-video/v2.0/master/image-to-video',
    mode: 'image-to-video',
    maxDuration: 20,
    costPerSecond: 42, // Fal cost 28¢/s, markup ×1.5 → 42 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 5 },
    durationOptions: [5, 10],
    hasAudio: false,
  },

  {
    id: 'kling-1.6-pro-image',
    name: 'Kling 1.6 Pro – Image → Video',
    falModelId: 'fal-ai/kling-video/v1.6/pro/image-to-video',
    mode: 'image-to-video',
    maxDuration: 20,
    costPerSecond: 17, // Fal cost 9.5¢/s, markup ×1.75 → 17 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 5 },
    durationOptions: [5, 10],
    hasAudio: false,
  },

  {
    id: 'stable-video-diffusion',
    name: 'Stable Video Diffusion – Image → Video',
    falModelId: 'fal-ai/stable-video-diffusion',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 3, // Fal cost ≈1.5¢/s (0.075 per 5s clip), markup ×2 → 3 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  },

  {
    id: 'ltx-video-13b-distilled',
    name: 'LTX Video 13B Distilled – Image → Video',
    falModelId: 'fal-ai/ltx-video/13b-distilled/image-to-video',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 2, // Fal cost ≈0.8¢/s (0.04 per 5s clip), markup ×2 → 2 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  },

  {
    id: 'wan-2.1-480p',
    name: 'WAN 2.1 (480p) – Image → Video',
    falModelId: 'fal-ai/wan/2.1/480p',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 8, // Fal cost ≈4¢/s (0.20 per 5s clip), markup ×2 → 8 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  },

  {
    id: 'pixverse-v4.5',
    name: 'Pixverse v4.5 – Image → Video',
    falModelId: 'fal-ai/pixverse/v4.5',
    mode: 'image-to-video',
    maxDuration: 10,
    costPerSecond: 14, // Fal cost 8¢/s, markup ×1.75 → 14 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 5 },
    durationOptions: [5, 10],
    hasAudio: false,
  },

  {
    id: 'hunyuan-custom-512',
    name: 'Hunyuan Custom 512p – Image → Video',
    falModelId: 'fal-ai/hunyuan/custom/512p',
    mode: 'image-to-video',
    maxDuration: 10,
    costPerSecond: 24, // Fal cost 16¢/s, markup ×1.5 → 24 credits
    supportedAspectRatios: ['1:1', '4:5', '9:16'],
    defaultParams: { fps: 24, motionLevel: 5 },
    durationOptions: [5, 10],
    hasAudio: false,
  },

  {
    id: 'hunyuan-avatar',
    name: 'Hunyuan Avatar – Image → Video',
    falModelId: 'fal-ai/hunyuan/avatar',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 42, // Fal cost 28¢/s, markup ×1.5 → 42 credits
    supportedAspectRatios: ['1:1', '9:16'],
    defaultParams: { fps: 24, motionLevel: 5 },
    durationOptions: [5],
    hasAudio: false,
  },

  {
    id: 'magi-1',
    name: 'MAGI-1 – Text → Video',
    falModelId: 'fal-ai/magi/v1',
    mode: 'text-to-video',
    maxDuration: 10,
    costPerSecond: 30, // Fal cost 20¢/s, markup ×1.5 → 30 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 6 },
    durationOptions: [4, 6, 8, 10],
    hasAudio: false,
  },
] 

// Runtime pricing overrides
// Allow dynamic adjustment of video pricing without code changes.
// 1. Global multiplier via `VIDEO_PRICING_MULTIPLIER` (e.g. "0.8" for 20% discount)
// 2. Model specific overrides via `VIDEO_MODEL_<MODEL_ID>_COST` where MODEL_ID is upper-case and non-alphanumeric chars replaced with `_`.
const pricingMultiplierEnv = process.env.VIDEO_PRICING_MULTIPLIER
const pricingMultiplier = pricingMultiplierEnv ? parseFloat(pricingMultiplierEnv) : 1

if (!Number.isNaN(pricingMultiplier) && pricingMultiplier !== 1) {
  VIDEO_MODELS.forEach(model => {
    model.costPerSecond = Number((model.costPerSecond * pricingMultiplier).toFixed(2))
  })
}

VIDEO_MODELS.forEach(model => {
  const envKey = `VIDEO_MODEL_${model.id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_COST`
  const override = process.env[envKey]
  if (override) {
    const parsed = parseFloat(override)
    if (!Number.isNaN(parsed)) {
      model.costPerSecond = parsed
    }
  }
})

/**
 * Get audio capability information for a model by ID
 */
export function getModelAudioCapability(modelId: string): { hasAudio: boolean; name: string } | null {
  const model = VIDEO_MODELS.find(m => m.id === modelId)
  if (!model) return null
  
  return {
    hasAudio: model.hasAudio,
    name: model.name
  }
}

/**
 * Get all models with audio support
 */
export function getModelsWithAudio(): VideoModel[] {
  return VIDEO_MODELS.filter(model => model.hasAudio)
}

/**
 * Get all models without audio support (video only)
 */
export function getVideoOnlyModels(): VideoModel[] {
  return VIDEO_MODELS.filter(model => !model.hasAudio)
} 