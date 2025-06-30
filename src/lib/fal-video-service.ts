import { fal } from '@fal-ai/client'
import { CloudStorageService } from './cloud-storage'
import { ImageProcessingService } from './image-processing-service'
import { VIDEO_MODELS, VideoModel } from './video-models'

// Video generation parameters based on Fal.ai video models
export interface VideoGenerationParams {
  prompt: string
  modelId: string
  duration?: number // seconds, 3-30
  aspectRatio?: '16:9' | '9:16' | '1:1' | '3:4' | '4:3'
  fps?: number // frames per second, 12-30
  motionLevel?: number // 1-10, controls amount of motion
  seed?: number
  width?: number
  height?: number
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
}

export class FalVideoService {
  private apiKey: string
  private baseUrl = 'https://fal.run'
  private cloudStorage: CloudStorageService

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FAL_API_TOKEN || ''
    if (!this.apiKey) {
      throw new Error('Fal.ai API key is required')
    }
    
    // Configure the fal client
    fal.config({
      credentials: this.apiKey,
    })
    
    this.cloudStorage = new CloudStorageService()
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
   * Calculate cost for video generation
   */
  calculateCost(modelId: string, duration: number): number {
    const model = this.getModelConfig(modelId)
    if (!model) return 0
    return model.costPerSecond * duration
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
          resolution: params.width && params.width >= 1280 ? "720p" : "480p", // Default to 720p if high width requested
          camera_fixed: false, // Optional, but keep for now
          seed: params.seed
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
          seed: params.seed
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

      // Download video
      const videoResponse = await fetch(videoUrl)
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status}`)
      }

      const videoBuffer = Buffer.from(await videoResponse.arrayBuffer())
      const fileSize = videoBuffer.length

      console.log('📊 Video downloaded:', {
        size: (fileSize / 1024 / 1024).toFixed(2) + 'MB',
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
      '4:3': { width: 1024, height: 768 }
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