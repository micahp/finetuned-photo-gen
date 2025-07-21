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
  /** Optional human-readable description (not used in pricing logic) */
  description?: string
  /** Optional pricing snippet from Fal.ai for reference */
  priceCostText?: string
  /** Baseline resolution that the `costPerSecond` value represents (e.g. "480p") */
  baselineResolution?: string
  /** Resolution-specific cost multipliers relative to the baseline costPerSecond */
  resolutionMultipliers?: Record<string, number>
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
    costPerSecond: 12, // Fal cost 8¢/s, markup ×1.5 → 12 credits
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
    costPerSecond: 12, // Fal cost 8¢/s, markup ×1.5 → 12 credits
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
    costPerSecond: 8, // Fal cost 4.5¢/s, markup ×1.75 → 8 credits
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
    costPerSecond: 8, // Fal cost 4.5¢/s, markup ×1.75 → 8 credits
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
    costPerSecond: 80, // Fal cost 75¢/s (audio), markup ×1.066 → 80 credits
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
    falModelId: 'fal-ai/veo3/fast',
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
    costPerSecond: 35, // Fal cost 28¢/s, markup ×1.25 → 35 credits
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
    costPerSecond: 55, // Fal cost 50¢/s, markup ×1.1 → 55 credits
    supportedAspectRatios: ['16:9', '9:16'],
    defaultParams: { fps: 30, motionLevel: 6 },
    durationOptions: [5, 6, 7, 8],
    hasAudio: false,
  },

  {
    id: 'veo-2-image',
    name: 'Veo 2 – Image → Video',
    falModelId: 'fal-ai/veo2/image-to-video',
    mode: 'image-to-video',
    maxDuration: 8,
    costPerSecond: 55, // Fal cost 50¢/s, markup ×1.1 → 55 credits
    supportedAspectRatios: ['16:9', '9:16'],
    defaultParams: { fps: 30, motionLevel: 6 },
    durationOptions: [5, 6, 7, 8],
    hasAudio: false,
  },

  {
    id: 'kling-2.0-master-image',
    name: 'Kling 2.0 Master – Image → Video',
    falModelId: 'fal-ai/kling-video/v2/master/image-to-video',
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
    falModelId: 'fal-ai/stable-video',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 3, // Fal cost ≈1.5¢/s (0.075 per 5s clip), markup ×2 → 3 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:5'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  },

  {
    id: 'ltx-video-13b-distilled',
    name: 'LTX Video 13B Distilled – Image → Video',
    falModelId: 'fal-ai/ltx-video-13b-distilled/image-to-video',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 2, // Fal cost ≈0.8¢/s (0.04 per 5s clip), markup ×2 → 2 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  },

  {
    id: 'wan-2.1',
    name: 'WAN 2.1 – Image → Video',
    falModelId: 'fal-ai/wan-i2v',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 8, // Fal cost ≈4¢/s (0.20 per 5s clip), markup ×2 → 8 credits (baseline 480p)
    description: 'Wan-2.1 generates high-quality videos with strong motion diversity from a single image.',
    priceCostText: 'Fal pricing: $0.20 at 480p, $0.40 at 720p (5-second clip).',
    baselineResolution: '480p',
    resolutionMultipliers: { '720p': 2 },
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  }, // We have to add resolution to our pricing for this model 

  {
    id: 'wan-flf2v',
    name: 'WAN FLF2V – Image → Video',
    falModelId: 'fal-ai/wan-flf2v',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 8, // Fal cost ≈4¢/s (0.20 per 5s clip), markup ×2 → 8 credits (baseline 480p)
    description: 'WAN-flf2v bridges first & last frames to create smooth motion sequences.',
    priceCostText: 'Fal pricing: $0.20 at 480p, $0.40 at 720p (5-second clip).',
    baselineResolution: '480p',
    resolutionMultipliers: { '720p': 2 },
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  }, // We have to add resolution to our pricing for this model 

  {
    id: 'pixverse-v4.5',
    name: 'Pixverse v4.5 – Image → Video',
    falModelId: 'fal-ai/pixverse/v4.5/image-to-video',
    mode: 'image-to-video',
    maxDuration: 10,
    costPerSecond: 14, // Fal cost 8¢/s, markup ×1.75 → 14 credits (baseline 360p)
    baselineResolution: '360p',
    resolutionMultipliers: { '540p': 1, '720p': 1.33, '1080p': 2.67 },
    priceCostText: 'Fal pricing per 5s: $0.15 (360/540p), $0.20 (720p), $0.40 (1080p).',
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 5 },
    durationOptions: [5, 10],
    hasAudio: false,
  },
  // We have to add resolution to our pricing for this model 
  

  {
    id: 'pixverse-v4.5-text',
    name: 'Pixverse v4.5 – Text → Video',
    falModelId: 'fal-ai/pixverse/v4.5/text-to-video',
    mode: 'text-to-video',
    maxDuration: 10,
    costPerSecond: 14, // Fal cost 8¢/s, markup ×1.75 → 14 credits (baseline 360p)
    description: 'Generate high-quality video clips from text prompts using PixVerse v4.5.',
    priceCostText: 'Fal pricing per 5s: $0.15 (360/540p), $0.20 (720p), $0.40 (1080p).',
    baselineResolution: '360p',
    resolutionMultipliers: { '540p': 1, '720p': 1.33, '1080p': 2.67 },
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 5 },
    durationOptions: [5, 10],
    hasAudio: false,
  }, // We have to add resolution to our pricing for this model 
  {
    id: 'pixverse-v4.5-effects',
    name: 'Pixverse v4.5 Effects – Image → Video',
    falModelId: 'fal-ai/pixverse/v4.5/effects',
    mode: 'image-to-video',
    maxDuration: 10,
    costPerSecond: 14, // Fal cost 8¢/s, markup ×1.75 → 14 credits (baseline 360p)
    description: 'Generate stylised effects using PixVerse v4.5.',
    priceCostText: 'Fal pricing per 5s: $0.15 (360/540p), $0.20 (720p), $0.40 (1080p).',
    baselineResolution: '360p',
    resolutionMultipliers: { '540p': 1, '720p': 1.33, '1080p': 2.67 },
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 5 },
    durationOptions: [5, 10],
    hasAudio: false,
  }, // We have to add resolution to our pricing for this model 

  {
    id: 'pixverse-v4.5-transition',
    name: 'Pixverse v4.5 Transition – Image → Video',
    falModelId: 'fal-ai/pixverse/v4.5/transition',
    mode: 'image-to-video',
    maxDuration: 10,
    costPerSecond: 14, // Fal cost 8¢/s, markup ×1.75 → 14 credits (baseline 360p)
    description: 'Create seamless transitions between images using PixVerse v4.5.',
    priceCostText: 'Fal pricing per 5s: $0.15 (360/540p), $0.20 (720p), $0.40 (1080p).',
    baselineResolution: '360p',
    resolutionMultipliers: { '540p': 1, '720p': 1.33, '1080p': 2.67 },
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 5 },
    durationOptions: [5, 10],
    hasAudio: false,
  }, // We have to add resolution to our pricing for this model 

  {
    id: 'hunyuan-custom-512',
    name: 'Hunyuan Custom 512p – Image → Video',
    falModelId: 'fal-ai/hunyuan-custom',
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
    falModelId: 'fal-ai/hunyuan-avatar',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 35, // Fal cost 28¢/s, markup ×1.25 → 35 credits
    supportedAspectRatios: ['1:1', '9:16'],
    defaultParams: { fps: 24, motionLevel: 5 },
    durationOptions: [5],
    hasAudio: false,
  },

  {
    id: 'magi-1',
    name: 'MAGI-1 – Text → Video',
    falModelId: 'fal-ai/magi',
    mode: 'text-to-video',
    maxDuration: 10,
    costPerSecond: 35, // For 5s video your request will cost $1.40, → $0.28/s → markup ×1.25 → 35 credits
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 6 },
    durationOptions: [4, 6, 8, 10],
    hasAudio: false,
  },

  /* ----------------------- Newly Added Fal.ai Endpoints ----------------------- */
  {
    id: 'fast-svd',
    name: 'Fast Stable Video Diffusion – Image → Video',
    falModelId: 'fal-ai/fast-svd',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 3, // Price not disclosed. We assume the rate matches the text‑to‑video endpoint ( $0.00111 / compute s ).
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 5 },
    // duration fixed to 25 frames (~2-3s); leave undefined to fallback
    hasAudio: false,
  },
  {
    id: 'fast-svd-text',
    name: 'Fast Stable Video Diffusion – Text → Video',
    falModelId: 'fal-ai/fast-svd/text-to-video',
    mode: 'text-to-video',
    maxDuration: 5,
    costPerSecond: 3, // Fal page: "Your request will cost $0.00111 per compute second." Matched to image variant at 12 credits/s.
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  },
  {
    id: 'fast-svd-lcm',
    name: 'Fast Stable Video Diffusion Turbo – Image → Video',
    falModelId: 'fal-ai/fast-svd-lcm',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 3, // Fal text to video page: "Your request will cost $0.00111 per compute second." We assume this is the same as the image to video page.
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 5 },
    hasAudio: false,
  },
  {
    id: 'ltx-video-13b-dev-image',
    name: 'LTX Video 13B Dev – Image → Video',
    falModelId: 'fal-ai/ltx-video-13b-dev/image-to-video',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 25, // Fal page: "Your request will cost $0.20 per video. For $1 you can run this model approximately 5 times."
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  },
  // Currently we don't support video uploads so we'll come back to this
  // {
  //   id: 'ltx-video-13b-dev-extend',
  //   name: 'LTX Video 13B Dev Extend – Image → Video',
  //   falModelId: 'fal-ai/ltx-video-13b-dev/extend',
  //   mode: 'image-to-video',
  //   maxDuration: 10,
  //   costPerSecond: 25, // Your request will cost $0.20 per video. For $1 you can run this model approximately 5 times.
  //   supportedAspectRatios: ['16:9', '9:16', '1:1'],
  //   defaultParams: { fps: 24, motionLevel: 4 },
  //   durationOptions: [5, 10],
  //   hasAudio: false,
  // },
  {
    id: 'ltx-video-v095-image',
    name: 'LTX Video v0.95 – Image → Video',
    falModelId: 'fal-ai/ltx-video-v095/image-to-video',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 5, // Your request will cost $0.02 per second, billed at 24 frames per second. For $1 you can generate 50 seconds of video. Enabling detail_pass will double the billed seconds.
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  }, // DEPRECATED
  {
    id: 'ltx-video-v095-mc-image',
    name: 'LTX Video v0.95 MC – Image → Video',
    falModelId: 'fal-ai/ltx-video-v095/multiconditioning',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 8, // Your request will cost $0.04 per video.

    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  },
  {
    id: 'fast-svd-lcm-text',
    name: 'Fast Stable Video Diffusion Turbo – Text → Video',
    falModelId: 'fal-ai/fast-svd-lcm/text-to-video',
    mode: 'text-to-video',
    maxDuration: 5,
    costPerSecond: 3, // Your request will cost $0.00111 per compute second.
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 5 },
    durationOptions: [5],
    hasAudio: false,
  },
  {
    id: 'wan-2.1-t2v',
    name: 'WAN 2.1 – Text → Video',
    falModelId: 'fal-ai/wan-t2v',
    mode: 'text-to-video',
    maxDuration: 5,
    costPerSecond: 8,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  },
  {
    id: 'minimax-video-01-text',
    name: 'MiniMax Video-01 – Text → Video',
    falModelId: 'fal-ai/minimax/video-01',
    mode: 'text-to-video',
    maxDuration: 10,
    costPerSecond: 12,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 5 },
    durationOptions: [6, 10],
    hasAudio: false,
  },
  {
    id: 'minimax-video-01-live-image',
    name: 'MiniMax Video-01 Live – Image → Video',
    falModelId: 'fal-ai/minimax/video-01/image-to-video',
    mode: 'image-to-video',
    maxDuration: 10,
    costPerSecond: 12,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 5 },
    durationOptions: [6, 10],
    hasAudio: false,
  },
  {
    id: 'ltx-preview-image',
    name: 'LTX Video Preview – Image → Video',
    falModelId: 'fal-ai/ltx-video/image-to-video',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 2,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  },
  {
    id: 'ltx-v095-text',
    name: 'LTX Video 0.9.5 – Text → Video',
    falModelId: 'fal-ai/ltx-video-v095',
    mode: 'text-to-video',
    maxDuration: 5,
    costPerSecond: 3,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  },
  {
    id: 'ltx-13b-dev-extend',
    name: 'LTX Video 13B Dev Extend – Video → Video',
    falModelId: 'fal-ai/ltx-video-13b-dev/extend',
    mode: 'image-to-video',
    maxDuration: 5,
    costPerSecond: 2,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  },
  {
    id: 'stable-video-diffusion-t2v',
    name: 'Stable Video Diffusion – Text → Video',
    falModelId: 'fal-ai/stable-video/text-to-video',
    mode: 'text-to-video',
    maxDuration: 5,
    costPerSecond: 1, // Your request will cost $0.00003 per compute second. → need to confimr this pricing with generations. 1 is our miminum
    supportedAspectRatios: ['16:9', '9:16', '1:1', '4:5'],
    defaultParams: { fps: 24, motionLevel: 4 },
    durationOptions: [5],
    hasAudio: false,
  },
] 

// Runtime pricing overrides
// Allow dynamic adjustment of video pricing without code changes.
// 1. Global multiplier via `VIDEO_PRICING_MULTIPLIER` (e.g. "0.8" for 20% discount)
// 2. Model specific overrides via `VIDEO_MODEL_<MODEL_ID>_COST` where MODEL_ID is upper-case and non-alphanumeric chars replaced with `