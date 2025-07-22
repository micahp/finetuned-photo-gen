import { fal } from '@fal-ai/client'
import { CloudStorageService } from './cloud-storage'
import { ImageProcessingService } from './image-processing-service'
import { VIDEO_MODELS, VideoModel } from './video-models'

// Video generation parameters based on Fal.ai video models
export interface VideoGenerationParams {
  prompt: string
  modelId: string
  duration?: number // seconds, 3-30
  aspectRatio?: '16:9' | '9:16' | '1:1' | '3:4' | '4:3' | '4:5'
  fps?: number // frames per second, 12-30
  motionLevel?: number // 1-10, controls amount of motion
  seed?: number
  width?: number
  height?: number
  /** Optional additional parameters uncovered in latest Fal specs */
  negativePrompt?: string // veo, fast-svd, ltx, pixverse
  enhancePrompt?: boolean // veo, fast-svd, ltx
  effects?: string[] // pixverse effect variant
  extend?: boolean // ltx dev_extend flag
  firstFrame?: string // wan-flf2v first frame URL
  lastFrame?: string // wan-flf2v last frame URL
  resolution?: string // High-resolution hint, e.g. "480p" | "720p" | "1080p"

  imageBuffer?: Buffer // For image-to-video generation
}

export interface VideoGenerationResponse {
  id: string
  status: 'processing' | 'completed' | 'failed'
  videoUrl?: string
  thumbnailUrl?: string
  duration?: number
  fileSize?: number
  width?: number
  height?: number
  fps?: number
  error?: string
  /** Original Fal.ai video URL that can be streamed while the Cloudflare copy is propagating */
  fallbackUrl?: string
}

export class FalVideoService {
  private apiKey: string
  private baseUrl = 'https://fal.run'
  private cloudStorage: CloudStorageService
  /**
   * When FAL_ENABLE_SAFETY_CHECKER is set to "false" we will disable the
   * built-in NSFW checker by passing `enable_safety_checker: false` in every
   * request.  Defaults to true to keep the current, safe behaviour unless the
   * environment variable explicitly opts out.
   */
  private readonly enableSafetyChecker: boolean

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FAL_API_TOKEN || ''
    // Log whether key present (parity with ReplicateService)
    if (!this.apiKey) {
      // eslint-disable-next-line no-console
      console.error('FAL_API_TOKEN missing. Available env vars:',
        Object.keys(process.env).filter(key => key.toUpperCase().includes('FAL')))
      throw new Error('Fal.ai API key is required. Please set FAL_API_TOKEN environment variable.')
    }
    // eslint-disable-next-line no-console
    console.log('✅ Fal.ai API token found')
    
    // Configure the fal client
    fal.config({
      credentials: this.apiKey,
    })
    
    this.cloudStorage = new CloudStorageService()

    // Evaluate env flag once during construction for minimal overhead.
    // Any value other than the explicit string "false" (case-insensitive)
    // keeps the checker ON.
    const envFlag = process.env.FAL_ENABLE_SAFETY_CHECKER?.toLowerCase() || 'false'
    this.enableSafetyChecker = envFlag !== 'false'
  }

  /**
   * Get available video models
   */
  getAvailableModels(): VideoModel[] {
    return VIDEO_MODELS
  }

  /**
   * Get specific model configuration
   */
  getModelConfig(modelId: string): VideoModel | null {
    return VIDEO_MODELS.find(model => model.id === modelId) || null
  }

  /**
   * Check if a given aspect ratio is supported by a specific model.
   */
  isAspectRatioSupported(modelId: string, aspectRatio: string): boolean {
    const model = this.getModelConfig(modelId);
    return model ? model.supportedAspectRatios.includes(aspectRatio) : false;
  }

  /**
   * Check if a given resolution is supported by a specific model.
   * A model supports a resolution when it declares it as its baseline or via
   * `resolutionMultipliers` in the pricing metadata.
   */
  isResolutionSupported(modelId: string, resolution: string): boolean {
    const model = this.getModelConfig(modelId)
    if (!model) return false

    // Collect allowed resolutions from baseline + multipliers if present
    const allowed: string[] = []
    if (model.baselineResolution) allowed.push(model.baselineResolution)
    if (model.resolutionMultipliers) {
      allowed.push(...Object.keys(model.resolutionMultipliers))
    }
    return allowed.includes(resolution)
  }

  /**
   * Calculate credits charged for a video generation request.
   *
   * The calculation supports two environment-level overrides that are useful
   * during testing or promotional pricing experiments:
   *  1. `VIDEO_MODEL_<MODEL_ID>_COST` – sets a fixed baseline
   *     `costPerSecond` **for that specific model** (after slug → env key
   *     transformation). When present, this value takes precedence over the
   *     global multiplier.
   *  2. `VIDEO_PRICING_MULTIPLIER` – a numeric multiplier applied to the
   *     model’s baseline `costPerSecond` to uniformly raise/lower prices.
   *
   * Both env vars should contain positive numbers. Invalid values (non-numbers
   * or ≤0) are ignored gracefully.
   */
  calculateCost(modelId: string, duration: number): number {
    const model = this.getModelConfig(modelId)
    if (!model) return 0

    // 1️⃣ Model-specific override → VIDEO_MODEL_<MODEL_ID>_COST
    const envKey = `VIDEO_MODEL_${modelId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_COST`
    const modelOverrideRaw = process.env[envKey]
    let costPerSecond = model.costPerSecond

    if (modelOverrideRaw) {
      const parsed = Number(modelOverrideRaw)
      if (!Number.isNaN(parsed) && parsed > 0) {
        costPerSecond = parsed
      }
    } else {
      // 2️⃣ Global multiplier override → VIDEO_PRICING_MULTIPLIER
      const multiplierRaw = process.env.VIDEO_PRICING_MULTIPLIER
      if (multiplierRaw) {
        const multiplier = Number(multiplierRaw)
        if (!Number.isNaN(multiplier) && multiplier > 0) {
          costPerSecond = costPerSecond * multiplier
        }
      }
    }

    return costPerSecond * duration
  }

  /**
   * Generate video using Fal.ai API
   */
  async generateVideo(params: VideoGenerationParams): Promise<VideoGenerationResponse> {
    try {
      const model = this.getModelConfig(params.modelId)
      if (!model) {
        throw new Error(`Unknown model: ${params.modelId}`)
      }

      console.log('🎬 Starting video generation with Fal.ai:', {
        model: model.name,
        mode: model.mode,
        prompt: params.prompt.substring(0, 100) + '...',
        duration: params.duration || 5,
        aspectRatio: params.aspectRatio || '16:9',
        hasImage: !!params.imageBuffer
      })

      // Validate duration
      const duration = Math.min(params.duration || 5, model.maxDuration)
      
      // For Seedance models, use different parameter structure
      if (model.falModelId.includes('seedance')) {
        // Enhance prompt for image-to-video if we have an image
        let enhancedPrompt = params.prompt
        if (model.mode === 'image-to-video' && params.imageBuffer) {
          // Add cinematic enhancement for image-to-video
          enhancedPrompt = params.prompt ? 
            `${params.prompt}. Create a cinematic video with smooth motion, natural lighting, and dynamic camera movement.` :
            'Create a cinematic video with smooth motion, natural lighting, and dynamic camera movement.'
        }

        // Seedance-specific parameters
        const requestPayload: any = {
          prompt: enhancedPrompt,
          duration: duration.toString(), // Seedance expects string "5" or "10"
          resolution: params.resolution && this.isResolutionSupported(model.id, params.resolution)
            ? params.resolution
            : (params.width && params.width >= 1280 ? "720p" : "480p"),
          camera_fixed: false, // Optional, but keep for now
          seed: params.seed,
          // Disable NSFW checker only when explicitly opted-out via env flag
          enable_safety_checker: this.enableSafetyChecker
        }

        // Add aspect ratio for text-to-video models
        if (model.mode === 'text-to-video') {
          requestPayload.aspect_ratio = params.aspectRatio || '16:9'
        }

        // For image-to-video models, handle image upload
        if (model.mode === 'image-to-video' && params.imageBuffer) {
          // Convert image buffer to base64 data URL for Fal.ai
          const base64Image = params.imageBuffer.toString('base64')
          const mimeType = this.detectImageMimeType(params.imageBuffer)
          requestPayload.image_url = `data:${mimeType};base64,${base64Image}`
        }

        console.log('📡 Sending request to Fal.ai Seedance:', {
          model: model.falModelId,
          mode: model.mode,
          hasImage: !!requestPayload.image_url,
          payload: { ...requestPayload, image_url: requestPayload.image_url ? '[IMAGE_DATA]' : undefined }
        })

        // Prefer asynchronous queue submission (no inbound webhook required)
        try {
          const submitResult = await fal.queue.submit(model.falModelId, {
            input: requestPayload
          }) as any

          console.log('✅ Fal.ai async job submitted (queue):', {
            requestId: submitResult.request_id || submitResult.requestId,
            status: 'processing'
          })

          return {
            id: submitResult.request_id || submitResult.requestId,
            status: 'processing'
          }
        } catch (queueError) {
          console.error('❌ Fal.ai queue submission failed, falling back to synchronous run:', queueError)
          // Fallback to synchronous processing if queue submission fails
          
          try {
            const result = await fal.run(model.falModelId, {
              input: requestPayload
            }) as any
            
            console.log('✅ Fal.ai Seedance video generation completed:', {
              requestId: result.request_id,
              hasVideo: !!result.video,
              hasImage: !!result.image,
              seed: result.seed
            })
            
            // Log entire result object for debugging
            console.dir(result, { depth: 5 })
            
            // Fal may return { video, image } or { data: { video, image } }
            const videoFile = (result.video || result.data?.video) as any
            const imageFile = (result.image || result.data?.image) as any

            if (videoFile && videoFile.url) {
              const videoUrl = videoFile.url
              const thumbnailUrl = imageFile?.url || null

              // Process and upload video to CloudFlare R2
              const processedVideo = await this.processAndUploadVideo(
                videoUrl,
                thumbnailUrl,
                `video_${Date.now()}.mp4`
              )

              if (!processedVideo.videoUrl) {
                throw new Error('Failed to upload video to cloud storage')
              }

              return {
                id: result.request_id || `fal_seedance_${Date.now()}`,
                status: 'completed',
                videoUrl: processedVideo.videoUrl,
                fallbackUrl: videoUrl,
                thumbnailUrl: processedVideo.thumbnailUrl,
                duration: duration,
                fileSize: processedVideo.fileSize,
                width: 1344, // Seedance 720p default width
                height: 768, // Seedance 720p default height
                fps: 24 // Seedance default fps
              }
            } else {
              // Handle case where no video is returned (likely an error)
              console.warn('⚠️ No video returned from Fal.ai Seedance generation')
              return {
                id: result.request_id || `fal_seedance_failed_${Date.now()}`,
                status: 'failed',
                error: 'No video generated by Fal.ai service'
              }
            }
          } catch (error) {
            console.error('❌ Fal.ai Seedance sync generation failed:', error)
            return {
              id: `fal_seedance_error_${Date.now()}`,
              status: 'failed',
              error: `Seedance generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }
        }
      } else {
        // For other models, use the existing parameter structure
        // Calculate dimensions based on aspect ratio
        const dimensions = this.getDimensions(params.aspectRatio || '16:9')
        
        // Prepare base request payload
        const requestPayload: any = {
          prompt: params.prompt,
          duration_seconds: duration,
          aspect_ratio: params.aspectRatio || '16:9',
          fps: params.fps || model.defaultParams.fps,
          motion_bucket_id: params.motionLevel || model.defaultParams.motionLevel,
          width: params.width || dimensions.width,
          height: params.height || dimensions.height,
          seed: params.seed,
          // Disable NSFW checker only when explicitly opted-out via env flag
          enable_safety_checker: this.enableSafetyChecker
        }

        // ----- Optional parameters (conditional by model capabilities) ----- //
        const modelSlug = model.falModelId

        // Negative prompt (veo, fast-svd, ltx, pixverse)
        if (params.negativePrompt && /(veo|fast-svd|ltx|pixverse)/i.test(modelSlug)) {
          requestPayload.negative_prompt = params.negativePrompt
        }

        // Enhance prompt flag (veo, fast-svd, ltx)
        if (typeof params.enhancePrompt === 'boolean' && /(veo|fast-svd|ltx)/i.test(modelSlug)) {
          requestPayload.enhance_prompt = params.enhancePrompt
        }

        // Effects array (pixverse effects endpoint)
        if (params.effects && params.effects.length && /pixverse.*effects/i.test(modelSlug)) {
          requestPayload.effects = params.effects
        }

        // Extend frames (ltx dev_extend flag)
        if (typeof params.extend === 'boolean' && /ltx/i.test(modelSlug)) {
          requestPayload.extend = params.extend
        }

        // First / last frame URLs (wan-flf2v)
        if (/wan-flf2v/i.test(modelSlug)) {
          if (params.firstFrame) requestPayload.first_frame_url = params.firstFrame
          if (params.lastFrame) requestPayload.last_frame_url = params.lastFrame
        }

        // Explicit resolution (models with multipliers)
        if (params.resolution && this.isResolutionSupported(model.id, params.resolution)) {
          requestPayload.resolution = params.resolution
        }

        // For image-to-video models, handle image upload
        if (model.mode === 'image-to-video' && params.imageBuffer) {
          // Convert image buffer to base64 data URL for Fal.ai
          const base64Image = params.imageBuffer.toString('base64')
          const mimeType = this.detectImageMimeType(params.imageBuffer)
          requestPayload.image_url = `data:${mimeType};base64,${base64Image}`
        }

        console.log('📡 Sending request to Fal.ai:', {
          model: model.falModelId,
          mode: model.mode,
          hasImage: !!requestPayload.image_url,
          payload: { ...requestPayload, image_url: requestPayload.image_url ? '[IMAGE_DATA]' : undefined }
        })

        // Prefer asynchronous queue submission (no inbound webhook required)
        try {
          const submitResult = await fal.queue.submit(model.falModelId, {
            input: requestPayload
          }) as any

          console.log('✅ Fal.ai async job submitted (queue):', {
            requestId: submitResult.request_id || submitResult.requestId,
            status: 'processing'
          })

          return {
            id: submitResult.request_id || submitResult.requestId,
            status: 'processing'
          }
        } catch (queueError) {
          console.error('❌ Fal.ai queue submission failed, falling back to synchronous run:', queueError)
          // Fallback to synchronous processing if queue submission fails
          
          try {
            const result = await fal.run(model.falModelId, {
              input: requestPayload
            }) as any
            
            console.log('✅ Fal.ai video generation completed:', {
              requestId: result.request_id,
              hasVideo: !!result.video,
              hasImage: !!result.image
            })
            
            // Log entire result object for debugging
            console.dir(result, { depth: 5 })
            
            // Fal may return { video, image } or { data: { video, image } }
            const videoFile = (result.video || result.data?.video) as any
            const imageFile = (result.image || result.data?.image) as any

            if (videoFile && videoFile.url) {
              const videoUrl = videoFile.url
              const thumbnailUrl = imageFile?.url || null

              // Process and upload video to CloudFlare R2
              const processedVideo = await this.processAndUploadVideo(
                videoUrl,
                thumbnailUrl,
                `video_${Date.now()}.mp4`
              )

              if (!processedVideo.videoUrl) {
                throw new Error('Failed to upload video to cloud storage')
              }

              return {
                id: result.request_id || `fal_video_${Date.now()}`,
                status: 'completed',
                videoUrl: processedVideo.videoUrl,
                fallbackUrl: videoUrl,
                thumbnailUrl: processedVideo.thumbnailUrl,
                duration: duration,
                fileSize: processedVideo.fileSize,
                width: dimensions.width,
                height: dimensions.height,
                fps: params.fps || model.defaultParams.fps
              }
            } else {
              // Handle case where no video is returned (likely an error)
              console.warn('⚠️ No video returned from Fal.ai generation')
              return {
                id: result.request_id || `fal_failed_${Date.now()}`,
                status: 'failed',
                error: 'No video generated by Fal.ai service'
              }
            }
          } catch (error) {
            console.error('❌ Fal.ai sync generation failed:', error)
            return {
              id: `fal_error_${Date.now()}`,
              status: 'failed',
              error: `Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
          }
        }
      }

    } catch (error) {
      console.error('❌ Fal.ai video generation error:', error)
      return {
        id: `fal_error_${Date.now()}`,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Video generation failed'
      }
    }
  }

  /**
   * Process video and upload to CloudFlare R2
   */
  async processAndUploadVideo(
    videoUrl: string,
    thumbnailUrl: string | null,
    filename: string
  ): Promise<{
    videoUrl: string
    thumbnailUrl?: string
    fileSize: number
  }> {
    try {
      console.log('🔄 Processing and uploading video to CloudFlare R2...')

      // Download video with extra diagnostics
      const videoResponse = await fetch(videoUrl)
      console.log('📥 VIDEO_FETCH_HEADERS', {
        status: videoResponse.status,
        contentType: videoResponse.headers.get('content-type'),
        contentLength: videoResponse.headers.get('content-length'),
        url: videoUrl
      })

      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status}`)
      }

      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())
      const fileSize = videoBuffer.length

      // Quick sanity-check on header bytes (should include ftyp mp4)
      const headerHex = videoBuffer.subarray(0, 12).toString('hex')
      console.log('📑 VIDEO_HEADER_HEX', headerHex)

      if (fileSize < 250_000) {
        console.warn('⚠️ VIDEO_SUSPICIOUS_SIZE', fileSize)
      }

      console.log('📊 Video downloaded:', {
        sizeMB: (fileSize / 1024 / 1024).toFixed(2),
        filename
      })

      // Upload to CloudFlare R2
      const uploadResult = await this.cloudStorage.uploadFile(
        filename,
        videoBuffer,
        'video/mp4',
        { folder: 'videos' }
      )

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(`Failed to upload video: ${uploadResult.error || 'No URL returned'}`)
      }

      let processedThumbnailUrl: string | undefined

      // Process thumbnail if available
      if (thumbnailUrl) {
        try {
          const thumbnailResponse = await fetch(thumbnailUrl)
          if (thumbnailResponse.ok) {
            const thumbnailBuffer = Buffer.from(await thumbnailResponse.arrayBuffer())
            const thumbnailFilename = filename.replace('.mp4', '_thumbnail.jpg')
            
            const thumbnailUpload = await this.cloudStorage.uploadFile(
              thumbnailFilename,
              thumbnailBuffer,
              'image/jpeg',
              { folder: 'videos' }
            )
            
            processedThumbnailUrl = thumbnailUpload.url
          }
        } catch (thumbnailError) {
          console.warn('⚠️ Failed to process thumbnail:', thumbnailError)
        }
      }

      console.log('✅ File uploaded to Cloudflare R2:', uploadResult.url)

      // Fetch the HEAD to verify metadata immediately
      try {
        const headResp = await fetch(uploadResult.url, { method: 'HEAD' })
        console.log('📄 R2_HEAD_METADATA', {
          status: headResp.status,
          contentType: headResp.headers.get('content-type'),
          contentLength: headResp.headers.get('content-length')
        })
      } catch (headErr) {
        console.warn('⚠️ R2_HEAD_FAILED', headErr)
      }

      console.log('✅ Video uploaded to CloudFlare R2:', {
        url: uploadResult.url,
        thumbnailUrl: processedThumbnailUrl
      })

      if (!uploadResult.url) {
        throw new Error('Failed to upload video - no URL returned')
      }

      return {
        videoUrl: uploadResult.url,
        thumbnailUrl: processedThumbnailUrl,
        fileSize
      }

    } catch (error) {
      console.error('❌ Video processing/upload error:', error)
      // Return original URL as fallback
      return {
        videoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl || undefined,
        fileSize: 0
      }
    }
  }

  /**
   * Get dimensions based on aspect ratio
   */
  private getDimensions(aspectRatio: string): { width: number; height: number } {
    const dimensionMap: Record<string, { width: number; height: number }> = {
      '16:9': { width: 1344, height: 768 },
      '9:16': { width: 768, height: 1344 },
      '1:1': { width: 1024, height: 1024 },
      '3:4': { width: 768, height: 1024 },
      '4:3': { width: 1024, height: 768 },
      '4:5': { width: 720, height: 900 }
    }
    
    return dimensionMap[aspectRatio] || dimensionMap['16:9']
  }

  /**
   * Detect MIME type from image buffer
   */
  private detectImageMimeType(buffer: Buffer): string {
    const header = buffer.toString('hex', 0, 4);

    if (header.startsWith('89504e47')) {
      return 'image/png';
    } else if (header.startsWith('ffd8ff')) {
      return 'image/jpeg';
    } else if (header.startsWith('47494638')) {
      return 'image/gif';
    } else {
      return 'application/octet-stream'; // Default or unknown
    }
  }

  /**
   * Check status of async video generation
   */
  async getJobStatus(jobId: string, modelId?: string): Promise<VideoGenerationResponse> {
    try {
      // If it's our custom fallback ID (not a real Fal.ai request ID), check database instead
      if (jobId.startsWith('fal_processing_') || jobId.startsWith('fal_error_') || jobId.startsWith('fal_video_') || 
          jobId.startsWith('fal_seedance_') || jobId.startsWith('fal_failed_')) {
        console.log('⚠️ Custom job ID detected - this should be handled by database lookup:', jobId)
        return {
          id: jobId,
          status: 'failed',
          error: 'Custom job ID - status should be checked via database, not Fal.ai API'
        }
      }

      // Default to Seedance model if no modelId provided (for backward compatibility)
      const model = modelId ? this.getModelConfig(modelId) : null
      const falModelId = model?.falModelId || 'fal-ai/bytedance/seedance/v1/lite/image-to-video'

      // Use the Fal.ai client to check queue status
      const result = await fal.queue.status(falModelId, {
        requestId: jobId,
        logs: true
      })

      console.log('📊 Fal.ai queue status:', result)

      if (result.status === 'COMPLETED') {
        // Get the actual result data
        const resultData = await fal.queue.result(falModelId, {
          requestId: jobId
        })

        console.log('📊 Fal.ai queue result:', resultData)

        if (resultData.data?.video) {
          const videoUrl = resultData.data.video.url
          const thumbnailUrl = resultData.data.image?.url || null

          // Process and upload video to CloudFlare R2
          const processedVideo = await this.processAndUploadVideo(
            videoUrl,
            thumbnailUrl,
            `video_${jobId}.mp4`
          )

          return {
            id: jobId,
            status: 'completed',
            videoUrl: processedVideo.videoUrl,
            fallbackUrl: videoUrl,
            thumbnailUrl: processedVideo.thumbnailUrl,
            fileSize: processedVideo.fileSize
          }
        }
      }

      // For any other status (IN_PROGRESS, IN_QUEUE) or if no video data
      return {
        id: jobId,
        status: 'processing'
      }

    } catch (error) {
      console.error('❌ Fal.ai job status check error:', error)
      return {
        id: jobId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Status check failed'
      }
    }
  }
} 