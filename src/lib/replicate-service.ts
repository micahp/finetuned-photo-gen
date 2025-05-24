import Replicate from 'replicate'

interface TrainingImage {
  id: string
  filename: string
  url: string
  size: number
}

interface ReplicateTrainingParams {
  modelName: string
  triggerWord: string
  trainingImages: TrainingImage[]
  zipUrl?: string
  steps?: number
  learningRate?: number
  loraRank?: number
  batchSize?: number
  resolution?: string
}

interface ReplicateTrainingResponse {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  urls?: {
    get: string
    cancel: string
  }
  error?: string
  output?: any
  logs?: string
}

export class ReplicateService {
  private client: Replicate

  constructor(apiToken?: string) {
    // Try multiple sources for the API token
    const token = apiToken || 
                  process.env.REPLICATE_API_TOKEN || 
                  process.env.NEXT_PUBLIC_REPLICATE_API_TOKEN
    
    if (!token) {
      console.error('Available environment variables:', Object.keys(process.env).filter(key => key.includes('REPLICATE')))
      throw new Error('Replicate API token is required. Please set REPLICATE_API_TOKEN environment variable.')
    }
    
    console.log(`✅ Replicate API token loaded (${token.substring(0, 8)}...)`)
    
    this.client = new Replicate({
      auth: token,
    })
  }

  /**
   * Create a destination model for training
   */
  async createDestinationModel(modelName: string, description?: string): Promise<{ success: boolean; modelId?: `${string}/${string}`; error?: string }> {
    try {
      console.log(`Creating destination model: ${modelName}`)
      
      // For now, use a fixed owner name (can be made dynamic later)
      const owner = 'micahp'
      
      const modelId = `flux-lora-${modelName.toLowerCase().replace(/\s+/g, '-')}`
      
      // Use the correct models.create API with positional arguments
      const model = await this.client.models.create(
        owner,
        modelId,
        {
          description: description || `Fine-tuned FLUX LoRA model for ${modelName}`,
          visibility: 'private' as const, // Start as private
          hardware: 'gpu-t4' as const // Required field
        }
      )
      
      console.log(`✅ Successfully created model: ${owner}/${modelId}`)
      const destinationId = `${owner}/${modelId}` as `${string}/${string}`
      return {
        success: true,
        modelId: destinationId
      }
    } catch (error) {
      console.error('Failed to create destination model:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Start FLUX LoRA training using Replicate
   */
  async startTraining(params: ReplicateTrainingParams): Promise<ReplicateTrainingResponse> {
    try {
      // Use provided ZIP URL or create one from training images
      const imageZipUrl = params.zipUrl || await this.packageImagesForTraining(params.trainingImages)
      
      console.log(`Using training images from: ${params.zipUrl ? 'provided ZIP URL' : 'legacy image URLs'}`)
      console.log(`ZIP URL: ${imageZipUrl}`)
      
      // Step 1: Create destination model if it doesn't exist
      console.log('Creating destination model...')
      const modelResult = await this.createDestinationModel(params.modelName)
      
      if (!modelResult.success) {
        throw new Error(`Failed to create destination model: ${modelResult.error}`)
      }
      
      console.log(`Using destination model: ${modelResult.modelId}`)
      
      // Step 2: Start training with the created model
      console.log('Starting Replicate training with correct version...')
      const training = await this.client.trainings.create(
        "ostris",
        "flux-dev-lora-trainer",
        "c6e78d2501e8088876e99ef21e4460d0dc121af7a4b786b9a4c2d75c620e300d",
        {
          destination: modelResult.modelId!,
          input: {
            input_images: imageZipUrl,
            trigger_word: params.triggerWord,
            steps: params.steps || 1000,
            lora_rank: params.loraRank || 16,
            optimizer: "adamw8bit",
            batch_size: params.batchSize || 1,
            resolution: params.resolution || "512,768,1024",
            autocaption: true,
            learning_rate: params.learningRate || 1e-4,
            // Additional FLUX-specific parameters
            caption_dropout_rate: 0.05,
            cache_latents_to_disk: false,
            wandb_project: "flux_train_replicate",
            max_sequence_length: 512,
          }
        }
      )

      console.log('Replicate training created successfully:', training.id)
      return {
        id: String(training.id),
        status: training.status as 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled',
        urls: training.urls,
      }

    } catch (error) {
      console.error('Replicate training error:', error)
      console.error('Full error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      })
      
      return {
        id: `error_${Date.now()}`,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Check training status
   */
  async getTrainingStatus(trainingId: string): Promise<ReplicateTrainingResponse> {
    try {
      const training = await this.client.trainings.get(trainingId)
      
      return {
        id: String(training.id),
        status: training.status as 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled',
        urls: training.urls,
        output: training.output,
        logs: typeof training.logs === 'string' ? training.logs : undefined,
        error: typeof training.error === 'string' ? training.error : undefined,
      }

    } catch (error) {
      console.error('Error getting training status:', error)
      return {
        id: trainingId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to get status'
      }
    }
  }

  /**
   * Cancel training
   */
  async cancelTraining(trainingId: string): Promise<boolean> {
    try {
      await this.client.trainings.cancel(trainingId)
      return true
    } catch (error) {
      console.error('Error canceling training:', error)
      return false
    }
  }

  /**
   * Package training images into a format suitable for Replicate
   * For now, this creates a simple image collection URL
   * In production, you'd want to create an actual ZIP file
   */
  private async packageImagesForTraining(images: TrainingImage[]): Promise<string> {
    // For MVP, we'll create a simple JSON manifest of image URLs
    // In production, you'd want to create an actual ZIP file and upload it
    const imageManifest = {
      images: images.map(img => ({
        filename: img.filename,
        url: img.url,
        size: img.size
      })),
      created_at: new Date().toISOString(),
      total_images: images.length
    }

    // TODO: In production, implement actual ZIP creation and upload
    // For now, we'll use the first image URL as a placeholder
    // Replicate expects either a ZIP file or individual image URLs
    
    // Return the manifest as a data URL for now
    // In production, you'd upload this to S3 or similar and return the URL
    const manifestJson = JSON.stringify(imageManifest)
    const manifestUrl = `data:application/json;base64,${Buffer.from(manifestJson).toString('base64')}`
    
    // Warning: This is a temporary implementation
    console.warn('TODO: Implement actual ZIP file creation for Replicate training')
    console.log('Image manifest:', imageManifest)
    
    // For now, return the first image URL since Replicate expects actual image URLs
    return images[0]?.url || ''
  }

  /**
   * Get available Replicate models for FLUX training
   */
  getAvailableTrainers() {
    return [
      {
        id: 'ostris/flux-dev-lora-trainer',
        name: 'FLUX Dev LoRA Trainer',
        description: 'Train LoRA models for FLUX.1-dev using ai-toolkit',
        version: 'c6e78d2501e8088876e99ef21e4460d0dc121af7a4b786b9a4c2d75c620e300d',
        estimatedTime: '10-30 minutes',
        cost: '$0.001525 per second'
      }
    ]
  }
} 