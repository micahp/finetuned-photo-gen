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
    costPerSecond: 25, // 2× markup over $0.12/sec
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
  },
  {
    id: 'seedance-pro-text',
    name: 'Seedance 1.0 Pro – Text → Video',
    falModelId: 'fal-ai/bytedance/seedance/v1/pro/text-to-video',
    mode: 'text-to-video',
    maxDuration: 10,
    costPerSecond: 25,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
  },
  {
    id: 'seedance-lite-image',
    name: 'Seedance 1.0 Lite – Image → Video',
    falModelId: 'fal-ai/bytedance/seedance/v1/lite/image-to-video',
    mode: 'image-to-video',
    maxDuration: 10,
    costPerSecond: 18, // 2× markup over $0.08/sec
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
  },
  {
    id: 'seedance-lite-text',
    name: 'Seedance 1.0 Lite – Text → Video',
    falModelId: 'fal-ai/bytedance/seedance/v1/lite/text-to-video',
    mode: 'text-to-video',
    maxDuration: 10,
    costPerSecond: 18,
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
  },

  /* -------------------------- Hailuo 02 (MiniMax) -------------------------- */
  {
    id: 'hailuo-02-pro-image',
    name: 'Hailuo 02 Pro – Image → Video',
    falModelId: 'fal-ai/minimax/hailuo-02/pro/image-to-video',
    mode: 'image-to-video',
    maxDuration: 15,
    costPerSecond: 28,
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
  },
  {
    id: 'hailuo-02-pro-text',
    name: 'Hailuo 02 Pro – Text → Video',
    falModelId: 'fal-ai/minimax/hailuo-02/pro/text-to-video',
    mode: 'text-to-video',
    maxDuration: 15,
    costPerSecond: 28,
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
  },
  {
    id: 'hailuo-02-standard-image',
    name: 'Hailuo 02 Standard – Image → Video',
    falModelId: 'fal-ai/minimax/hailuo-02/standard/image-to-video',
    mode: 'image-to-video',
    maxDuration: 15,
    costPerSecond: 22,
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
  },
  {
    id: 'hailuo-02-standard-text',
    name: 'Hailuo 02 Standard – Text → Video',
    falModelId: 'fal-ai/minimax/hailuo-02/standard/text-to-video',
    mode: 'text-to-video',
    maxDuration: 15,
    costPerSecond: 22,
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
  },

  /* --------------------------------- Veo 3 --------------------------------- */
  {
    id: 'veo-3-text',
    name: 'Veo 3 – Text → Video',
    falModelId: 'fal-ai/veo3',
    mode: 'text-to-video',
    maxDuration: 30,
    costPerSecond: 50,
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 30,
      motionLevel: 6,
    },
  },

  /* -------------------------- Kling 2.1 (Kuaishou) -------------------------- */
  {
    id: 'kling-2.1-master-image',
    name: 'Kling 2.1 Master – Image → Video',
    falModelId: 'fal-ai/kling-video/v2.1/master/image-to-video',
    mode: 'image-to-video',
    maxDuration: 20,
    costPerSecond: 55,
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
  },
  {
    id: 'kling-2.1-pro-image',
    name: 'Kling 2.1 Pro – Image → Video',
    falModelId: 'fal-ai/kling-video/v2.1/pro/image-to-video',
    mode: 'image-to-video',
    maxDuration: 20,
    costPerSecond: 36,
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
  },
  {
    id: 'kling-2.1-standard-image',
    name: 'Kling 2.1 Standard – Image → Video',
    falModelId: 'fal-ai/kling-video/v2.1/standard/image-to-video',
    mode: 'image-to-video',
    maxDuration: 20,
    costPerSecond: 26,
    supportedAspectRatios: ['16:9', '9:16', '1:1', '3:4', '4:3'],
    defaultParams: {
      fps: 24,
      motionLevel: 5,
    },
  },
] 