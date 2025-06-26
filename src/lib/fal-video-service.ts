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
        prompt: params.prompt.substring(0, 100) + '...',
        duration: params.duration || model.defaultParams.fps,
        aspectRatio: params.aspectRatio || '16:9'
      })

      // Validate duration
      const duration = Math.min(params.duration || 5, model.maxDuration)
      
      // Calculate dimensions based on aspect ratio
      const dimensions = this.getDimensions(params.aspectRatio || '16:9')
      
      // Prepare request payload
      const requestPayload = {
        prompt: params.prompt,
        duration_seconds: duration,
        aspect_ratio: params.aspectRatio || '16:9',
        fps: params.fps || model.defaultParams.fps,
        motion_bucket_id: params.motionLevel || model.defaultParams.motionLevel,
        width: params.width || dimensions.width,
        height: params.height || dimensions.height,
        seed: params.seed
      }

      console.log('📡 Sending request to Fal.ai:', {
        model: model.falModelId,
        payload: requestPayload
      })

      // Submit video generation job
      const response = await fetch(`${this.baseUrl}/${model.falModelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Fal.ai API error: ${response.status}`)
      }

      const result = await response.json()
      
      console.log('✅ Fal.ai video generation completed:', {
        requestId: result.request_id,
        hasVideo: !!result.video,
        hasImage: !!result.image
      })

      // Handle successful response
      if (result.video && result.video.url) {
        const videoUrl = result.video.url
        const thumbnailUrl = result.image?.url || null

        // Process and upload video to CloudFlare R2
        const processedVideo = await this.processAndUploadVideo(
          videoUrl,
          thumbnailUrl,
          `video_${Date.now()}.mp4`
        )

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
        // Handle async processing (if Fal.ai returns job ID for longer videos)
        return {
          id: result.request_id || `fal_processing_${Date.now()}`,
          status: 'processing'
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
   * Check status of async video generation
   */
  async getJobStatus(jobId: string): Promise<VideoGenerationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/queue/requests/${jobId}/status`, {
        headers: {
          'Authorization': `Key ${this.apiKey}`,
        }
      })

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`)
      }

      const result = await response.json()

      if (result.status === 'COMPLETED' && result.data?.video) {
        const videoUrl = result.data.video.url
        const thumbnailUrl = result.data.image?.url || null

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
      } else if (result.status === 'FAILED') {
        return {
          id: jobId,
          status: 'failed',
          error: result.error || 'Video generation failed'
        }
      } else {
        return {
          id: jobId,
          status: 'processing'
        }
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

  /**
   * Process video and upload to CloudFlare R2
   */
  private async processAndUploadVideo(
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
   * Validate model supports aspect ratio
   */
  isAspectRatioSupported(modelId: string, aspectRatio: string): boolean {
    const model = this.getModelConfig(modelId)
    return model ? model.supportedAspectRatios.includes(aspectRatio) : false
  }
} 