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
  trainingImages: TrainingImage[] // Kept for backwards compatibility but not used
  zipUrl: string // REQUIRED: Must be a valid ZIP file URL for Replicate training
  baseModel?: string // Base model to train on
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
  input?: any
  destinationModelId?: string // The destination model ID created for training
}

interface ReplicateGenerationResponse {
  id: string
  status: 'completed' | 'failed' | 'processing'
  images?: Array<{
    url: string
    width: number
    height: number
  }>
  error?: string
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
    
    console.log('✅ Replicate API token found')
    
    try {
      this.client = new Replicate({
        auth: token,
      })
      console.log('✅ Replicate client initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize Replicate client:', error)
      throw error
    }
  }

  /**
   * Create a destination model for training
   */
  async createDestinationModel(modelName: string, description?: string): Promise<{ success: boolean; modelId?: `${string}/${string}`; error?: string }> {
    try {
      console.log(`Creating destination model: ${modelName}`)
      
      // For now, use a fixed owner name (can be made dynamic later)
      const owner = 'micahp'
      
      // Generate unique model ID with timestamp and random suffix
      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const modelId = `flux-lora-${modelName.toLowerCase().replace(/\s+/g, '-')}-${timestamp}-${randomSuffix}`
      
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
      // Ensure we have a valid ZIP URL - this is REQUIRED for Replicate validation
      if (!params.zipUrl) {
        throw new Error('ZIP URL is required for Replicate training. Please create a ZIP file of training images first.')
      }

      // Validate ZIP URL format
      if (!params.zipUrl.startsWith('http') && !params.zipUrl.startsWith('/api/')) {
        throw new Error(`Invalid ZIP URL format: ${params.zipUrl}. Must be a valid HTTP URL or API endpoint.`)
      }
      
      console.log(`Using training images ZIP: ${params.zipUrl}`)
      
      // Step 1: Create destination model if it doesn't exist
      console.log('Creating destination model...')
      const modelResult = await this.createDestinationModel(params.modelName)
      
      if (!modelResult.success) {
        throw new Error(`Failed to create destination model: ${modelResult.error}`)
      }
      
      console.log(`Using destination model: ${modelResult.modelId}`)
      
      // Step 2: Select trainer based on base model
      const baseModel = params.baseModel || 'black-forest-labs/FLUX.1-dev'
      let trainerOwner: string
      let trainerName: string
      let trainerVersion: string
      let trainingInput: any
      
      if (baseModel === 'stabilityai/stable-diffusion-xl-base-1.0' || baseModel === 'stability-ai/sdxl') {
        // SDXL trainer configuration
        trainerOwner = "edenartlab"
        trainerName = "sdxl-lora-trainer"
        trainerVersion = "4767bababe6048535114863799de828c25ec5b935dab7f879d4fa29495118d22"
        trainingInput = {
          input_images: params.zipUrl,
          trigger_word: params.triggerWord,
          max_train_steps: params.steps || 1000,
          lora_rank: params.loraRank || 16,
          optimizer: "adamw8bit",
          batch_size: params.batchSize || 1,
          resolution: params.resolution || "1024",
          autocaption: true,
          learning_rate: params.learningRate || 0.0004,
          lr_scheduler: "constant",
          lr_warmup_steps: 0,
          seed: 42,
          cache_latents_to_disk: false
        }
      } else {
        // FLUX.1-dev trainer configuration (default)
        trainerOwner = "ostris"
        trainerName = "flux-dev-lora-trainer"
        trainerVersion = "c6e78d2501e8088876e99ef21e4460d0dc121af7a4b786b9a4c2d75c620e300d"
        trainingInput = {
          input_images: params.zipUrl,
          trigger_word: params.triggerWord,
          steps: params.steps || 1000,
          lora_rank: params.loraRank || 16,
          optimizer: "adamw8bit",
          batch_size: params.batchSize || 1,
          resolution: params.resolution || "512,768,1024",
          autocaption: true,
          learning_rate: params.learningRate || 0.0004,
          caption_dropout_rate: 0.05,
          cache_latents_to_disk: false,
          wandb_project: "flux_train_replicate",
          wandb_save_interval: 100,
          wandb_sample_interval: 100,
          gradient_checkpointing: false,
        }
      }
      
      // Step 3: Start training with the selected trainer
      console.log(`Starting ${baseModel} training with ${trainerOwner}/${trainerName}...`)
      const training = await this.client.trainings.create(
        trainerOwner,
        trainerName,
        trainerVersion,
        {
          destination: modelResult.modelId!,
          input: trainingInput
        }
      )

      console.log('✅ Replicate training created successfully:', training.id)
      return {
        id: String(training.id),
        status: training.status as 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled',
        urls: training.urls,
        destinationModelId: modelResult.modelId, // Include the destination model ID
      }

    } catch (error) {
      console.error('❌ Replicate training error:', error)
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
      
      // Log detailed status for debugging
      if (training.status === 'failed' || training.error) {
        console.log('🔍 REPLICATE STATUS DEBUG - Training failed details:', {
          id: training.id,
          status: training.status,
          error: training.error,
          logs: training.logs,
          input: training.input, // This might show us what input Replicate received
          created_at: training.created_at,
          completed_at: training.completed_at
        })
      }
      
      return {
        id: String(training.id),
        status: training.status as 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled',
        urls: training.urls,
        output: training.output,
        logs: typeof training.logs === 'string' ? training.logs : undefined,
        error: typeof training.error === 'string' ? training.error : undefined,
        input: training.input, // Capture input parameters to see what Replicate received
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
   * Generate image with base Replicate model (for FLUX Pro models)
   */
  async generateWithBaseModel(params: {
    model: string // e.g., "black-forest-labs/flux-pro"
    prompt: string
    aspectRatio?: string
    seed?: number
    width?: number
    height?: number
  }): Promise<ReplicateGenerationResponse> {
    try {
      console.log(`🎨 Using Replicate base model: ${params.model}`)

      // Convert aspect ratio to Replicate format
      const aspectRatioMap: Record<string, string> = {
        '1:1': '1:1',
        '16:9': '16:9', 
        '9:16': '9:16',
        '3:4': '3:4',
        '4:3': '4:3'
      }
      
      const replicateAspectRatio = aspectRatioMap[params.aspectRatio || '1:1'] || '1:1'

      // Use Replicate's client to run the model
      const prediction = await this.client.run(
        params.model as any,
        {
          input: {
            prompt: params.prompt,
            aspect_ratio: replicateAspectRatio,
            output_format: "webp",
            output_quality: 90,
            safety_tolerance: 2,
            seed: params.seed
          }
        }
      )

      console.log('🎯 Replicate base model prediction result:', {
        predictionType: typeof prediction,
        isArray: Array.isArray(prediction),
        length: Array.isArray(prediction) ? prediction.length : 'not array',
        hasUrlMethod: prediction && typeof prediction === 'object' && 'url' in prediction && typeof (prediction as any).url === 'function',
        constructorName: prediction?.constructor?.name
      })

      // Handle Replicate response - modern versions return FileOutput objects for images
      let imageUrl: string
      
      if (Array.isArray(prediction) && prediction.length > 0) {
        // Handle array of results
        const firstResult = prediction[0]
        if (firstResult && typeof firstResult === 'object' && 'url' in firstResult && typeof firstResult.url === 'function') {
          // Modern FileOutput object with .url() method
          const urlResult = (firstResult as any).url()
          imageUrl = String(urlResult) // Convert URL object to string
          console.log('✅ Extracted URL from FileOutput array item:', imageUrl)
        } else if (typeof firstResult === 'string') {
          // Direct URL string
          imageUrl = firstResult
          console.log('✅ Using direct URL string from array:', imageUrl)
        } else {
          console.error('❌ Unknown array item format:', firstResult)
          throw new Error('Unknown array item format in Replicate response')
        }
      } else if (prediction && typeof prediction === 'object' && 'url' in prediction && typeof prediction.url === 'function') {
        // Single FileOutput object with .url() method
        const urlResult = (prediction as any).url()
        imageUrl = String(urlResult) // Convert URL object to string
        console.log('✅ Extracted URL from FileOutput object:', imageUrl)
      } else if (typeof prediction === 'string') {
        // Direct URL string
        imageUrl = prediction
        console.log('✅ Using direct URL string:', imageUrl)
      } else if (prediction && typeof prediction === 'object') {
        // Handle object response - Replicate might return the URL directly or nested
        const predictionObj = prediction as any
        if (predictionObj.output) {
          // If there's an output field, check if it's a FileOutput or string
          const output = predictionObj.output
          if (Array.isArray(output) && output.length > 0) {
            const firstOutput = output[0]
            if (firstOutput && typeof firstOutput === 'object' && 'url' in firstOutput && typeof firstOutput.url === 'function') {
              const urlResult = (firstOutput as any).url()
              imageUrl = String(urlResult) // Convert URL object to string
            } else if (typeof firstOutput === 'string') {
              imageUrl = firstOutput
            } else {
              throw new Error('Unknown output array format in Replicate response')
            }
          } else if (output && typeof output === 'object' && 'url' in output && typeof output.url === 'function') {
            const urlResult = (output as any).url()
            imageUrl = String(urlResult) // Convert URL object to string
          } else if (typeof output === 'string') {
            imageUrl = output
          } else {
            throw new Error('Unknown output format in Replicate response')
          }
        } else if (predictionObj.url) {
          // Some models return a url field
          imageUrl = String(predictionObj.url) // Ensure it's a string
        } else {
          // Try to find the first string value that looks like a URL
          const values = Object.values(predictionObj)
          const urlValue = values.find(val => 
            typeof val === 'string' && 
            (val.startsWith('http') || val.startsWith('data:'))
          )
          if (urlValue) {
            imageUrl = urlValue as string
          } else {
            console.error('❌ Could not find image URL in prediction object:', prediction)
            throw new Error('No image URL found in Replicate response')
          }
        }
      } else {
        console.error('❌ Unexpected prediction format:', prediction)
        throw new Error('Invalid response from Replicate - no images returned')
      }

      if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
        const dimensions = this.getDimensions(params.aspectRatio)
        
        console.log('✅ Final extracted image URL:', {
          url: imageUrl,
          type: typeof imageUrl,
          length: imageUrl.length,
          isHttpUrl: imageUrl.startsWith('http'),
          urlPreview: imageUrl.substring(0, 100) + (imageUrl.length > 100 ? '...' : '')
        })
        
        return {
          id: `replicate_base_${Date.now()}`,
          status: 'completed',
          images: [{
            url: imageUrl,
            width: params.width || dimensions.width,
            height: params.height || dimensions.height
          }]
        }
      } else {
        console.error('❌ Invalid image URL:', {
          url: imageUrl,
          type: typeof imageUrl,
          isString: typeof imageUrl === 'string',
          startsWithHttp: typeof imageUrl === 'string' ? imageUrl.startsWith('http') : 'not string'
        })
        throw new Error('Image URL is empty or invalid')
      }

    } catch (error) {
      console.error('❌ Replicate base model generation error:', error)
      return {
        id: `replicate_base_err_${Date.now()}`,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Replicate base model generation failed'
      }
    }
  }

  /**
   * Generate image with trained Replicate model directly
   */
  async generateWithTrainedModel(params: {
    prompt: string
    replicateModelId: string  // e.g., "micahp/flux-lora-xyz"
    triggerWord?: string
    width?: number
    height?: number
    steps?: number
    aspectRatio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3'
    seed?: number
  }): Promise<ReplicateGenerationResponse> {
    try {
      console.log('🎨 Starting Replicate trained model generation:', {
        prompt: params.prompt,
        replicateModelId: params.replicateModelId,
        triggerWord: params.triggerWord
      })

      // Build the enhanced prompt with trigger word
      let enhancedPrompt = params.prompt
      if (params.triggerWord && !params.prompt.toLowerCase().includes(params.triggerWord.toLowerCase())) {
        enhancedPrompt = `${params.triggerWord}, ${params.prompt}`
      }

      // Calculate dimensions based on aspect ratio
      const dimensions = this.getDimensions(params.aspectRatio)
      const width = params.width || dimensions.width
      const height = params.height || dimensions.height

      // Validate model ID format
      if (!params.replicateModelId || !params.replicateModelId.includes('/') || !params.replicateModelId.includes(':')) {
        throw new Error(`Invalid Replicate model ID format: ${params.replicateModelId}. Expected format: owner/model:version`)
      }

      // Extract version from replicateModelId
      const version = params.replicateModelId.split(':').pop()
      if (!version) {
        throw new Error(`Could not extract version from replicateModelId: ${params.replicateModelId}`)
      }

      console.log('🔧 Replicate trained model parameters:', {
        prompt: enhancedPrompt,
        model: params.replicateModelId,
        width,
        height,
        num_inference_steps: params.steps || 28,
        seed: params.seed
      })

      // Use predictions.create() to get full prediction object with status
      console.log('📡 Creating Replicate prediction...')
      const prediction = await this.client.predictions.create({
        version: version, // Use extracted version ID here
        input: {
          prompt: enhancedPrompt,
          width,
          height,
          num_inference_steps: params.steps || 28,
          seed: params.seed,
          guidance_scale: 3.5,
          num_outputs: 1,
          output_format: "webp",
          output_quality: 90
        }
      })
      console.log('📡 Replicate prediction created:', prediction.id)

      // Wait for the prediction to complete
      console.log('⏳ Waiting for prediction to complete...')
      const completedPrediction = await this.client.wait(prediction)
      console.log('✅ Prediction completed with status:', completedPrediction.status)

      // Enhanced logging to debug the response structure
      console.log('🔍 FULL Replicate response structure:', {
        prediction: completedPrediction,
        predictionType: typeof completedPrediction,
        predictionKeys: completedPrediction ? Object.keys(completedPrediction) : 'null',
        id: completedPrediction?.id,
        status: completedPrediction?.status,
        output: completedPrediction?.output,
        error: completedPrediction?.error,
        urls: completedPrediction?.urls
      })

      console.log('🎨 Replicate trained model generation completed:', {
        id: completedPrediction?.id,
        status: completedPrediction?.status,
        hasOutput: !!completedPrediction?.output,
        outputType: typeof completedPrediction?.output,
        outputLength: Array.isArray(completedPrediction?.output) ? completedPrediction.output.length : 'not array'
      })

      // Check if prediction is null or undefined
      if (!completedPrediction) {
        console.error('❌ Prediction is null or undefined')
        return {
          id: `replicate_null_${Date.now()}`,
          status: 'failed',
          error: 'Replicate returned null response'
        }
      }

      // Handle the response with more robust checking
      if (completedPrediction.status === 'succeeded' && completedPrediction.output) {
        const imageUrl = Array.isArray(completedPrediction.output) ? String(completedPrediction.output[0]) : String(completedPrediction.output)
        
        console.log('✅ Generation succeeded, image URL:', imageUrl)
        
        return {
          id: String(completedPrediction.id || `success_${Date.now()}`),
          status: 'completed',
          images: [{
            url: imageUrl as string,
            width,
            height
          }]
        }
      } else if (completedPrediction.status === 'failed') {
        console.error('❌ Generation failed:', completedPrediction.error)
        return {
          id: String(completedPrediction.id || `failed_${Date.now()}`),
          status: 'failed',
          error: String(completedPrediction.error) || 'Replicate trained model generation failed'
        }
      } else if (completedPrediction.status === 'processing' || completedPrediction.status === 'starting') {
        console.log('⏳ Generation still processing')
        return {
          id: String(completedPrediction.id || `processing_${Date.now()}`),
          status: 'processing'
        }
      } else {
        // Handle unexpected status or missing status
        console.error('❌ Unexpected prediction status or structure:', {
          status: completedPrediction.status,
          hasId: !!completedPrediction.id,
          hasOutput: !!completedPrediction.output,
          hasError: !!completedPrediction.error
        })
        
        return {
          id: String(completedPrediction.id || `unknown_${Date.now()}`),
          status: 'failed',
          error: `Unexpected response status: ${completedPrediction.status || 'undefined'}`
        }
      }

    } catch (error) {
      console.error('❌ Replicate trained model generation error:', error)
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      })
      
      return {
        id: `replicate_trained_err_${Date.now()}`,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Replicate trained model generation failed'
      }
    }
  }

  /**
   * Generate image with LoRA using Replicate
   */
  async generateWithLoRA(params: {
    prompt: string
    loraPath: string  // HuggingFace repository path
    loraScale?: number
    triggerWord?: string
    width?: number
    height?: number
    steps?: number
    aspectRatio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3'
    seed?: number
  }): Promise<ReplicateGenerationResponse> {
    try {
      console.log('🎨 Starting Replicate LoRA generation:', {
        prompt: params.prompt,
        loraPath: params.loraPath,
        triggerWord: params.triggerWord
      })

      // Build the enhanced prompt with trigger word
      let enhancedPrompt = params.prompt
      if (params.triggerWord && !params.prompt.toLowerCase().includes(params.triggerWord.toLowerCase())) {
        enhancedPrompt = `${params.triggerWord}, ${params.prompt}`
      }

      // Calculate dimensions based on aspect ratio
      const dimensions = this.getDimensions(params.aspectRatio)
      const width = params.width || dimensions.width
      const height = params.height || dimensions.height

      // Format LoRA path for Replicate (expects HuggingFace format)
      const formattedLoraPath = params.loraPath.startsWith('https://huggingface.co/') 
        ? params.loraPath 
        : `https://huggingface.co/${params.loraPath}`

      console.log('🔧 Replicate generation parameters:', {
        prompt: enhancedPrompt,
        lora_url: formattedLoraPath,
        lora_scale: params.loraScale || 1.0,
        width,
        height,
        num_inference_steps: params.steps || 28,
        seed: params.seed
      })

      // Run the prediction using black-forest-labs/flux-dev-lora
      const prediction = await this.client.run(
        "black-forest-labs/flux-dev-lora",
        {
          input: {
            prompt: enhancedPrompt,
            lora_url: formattedLoraPath,
            lora_scale: params.loraScale || 1.0,
            width,
            height,
            num_inference_steps: params.steps || 28,
            seed: params.seed,
            go_fast: true, // Use optimized inference
            guidance_scale: 3.5,
            num_outputs: 1,
            output_format: "webp",
            output_quality: 90
          }
        }
      ) as any

      console.log('🎨 Replicate generation completed:', {
        id: prediction.id,
        status: prediction.status,
        hasOutput: !!prediction.output
      })

      // Handle the response
      if (prediction.status === 'succeeded' && prediction.output) {
        const imageUrl = Array.isArray(prediction.output) ? String(prediction.output[0]) : String(prediction.output)
        
        return {
          id: String(prediction.id),
          status: 'completed',
          images: [{
            url: imageUrl,
            width,
            height
          }]
        }
      } else if (prediction.status === 'failed') {
        return {
          id: String(prediction.id),
          status: 'failed',
          error: prediction.error || 'Replicate generation failed'
        }
      } else {
        return {
          id: String(prediction.id),
          status: 'processing'
        }
      }

    } catch (error) {
      console.error('❌ Replicate LoRA generation error:', error)
      return {
        id: `replicate_err_${Date.now()}`,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Replicate generation failed'
      }
    }
  }

  /**
   * Get dimensions based on aspect ratio
   */
  private getDimensions(aspectRatio?: string): { width: number; height: number } {
    switch (aspectRatio) {
      case '16:9':
        return { width: 1344, height: 768 }
      case '9:16':
        return { width: 768, height: 1344 }
      case '3:4':
        return { width: 896, height: 1152 }
      case '4:3':
        return { width: 1152, height: 896 }
      case '1:1':
      default:
        return { width: 1024, height: 1024 }
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
   * Get available Replicate models for FLUX training
   */
  getAvailableTrainers() {
    return [
      {
        id: 'ostris/flux-dev-lora-trainer',
        name: 'FLUX Dev LoRA Trainer',
        description: 'Train LoRA models for FLUX.1-dev using ai-toolkit',
        version: 'c6e78d2501e8088876e99ef21e4460d0dc121af7a4b786b9a4c2d75c620e300d',
        baseModel: 'black-forest-labs/FLUX.1-dev',
        estimatedTime: '10-30 minutes',
        cost: '$0.001525 per second'
      },
      {
        id: 'edenartlab/sdxl-lora-trainer',
        name: 'SDXL LoRA Trainer', 
        description: 'Train LoRA models for Stable Diffusion XL',
        version: '4767bababe6048535114863799de828c25ec5b935dab7f879d4fa29495118d22',
        baseModel: 'stability-ai/sdxl',
        estimatedTime: '15-45 minutes',
        cost: 'Variable pricing'
      }
    ]
  }
} 