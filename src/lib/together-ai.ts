import { TogetherGenerationResponse, TogetherModelResponse } from '@/lib/types'
import { ReplicateService } from '@/lib/replicate-service'

interface GenerateImageParams {
  prompt: string
  model?: string
  width?: number
  height?: number
  steps?: number
  seed?: number
  aspectRatio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3'
  imageLoras?: Array<{
    path: string  // HuggingFace repository path
    scale?: number
  }>
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

interface TrainLoRAParams {
  name: string
  description?: string
  baseModel?: string
  trainingImages: Array<{
    url: string
    caption?: string
  }>
  triggerWord?: string
  learningRate?: number
  epochs?: number
  batchSize?: number
}

interface TrainLoRAResponse {
  id: string
  status: 'queued' | 'training' | 'completed' | 'failed'
  name: string
  progress?: number
  estimatedTimeRemaining?: number
  error?: string
}

interface BatchGenerateParams {
  prompts: string[]
  model?: string
  width?: number
  height?: number
  steps?: number
  aspectRatio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3'
  batchSize?: number
}

interface BatchGenerateResponse {
  batchId: string
  status: 'processing' | 'completed' | 'failed'
  results: Array<{
    prompt: string
    image?: {
      url: string
      width: number
      height: number
    }
    error?: string
  }>
  completedCount: number
  totalCount: number
}

// Together.ai custom model upload interfaces
interface TogetherModelUploadParams {
  modelName: string
  modelSource: string  // HuggingFace repo or S3 URL
  description?: string
  hfToken?: string  // Required for HuggingFace uploads
}

interface TogetherModelUploadResponse {
  jobId: string
  modelId: string
  modelName: string
  status: 'processing' | 'completed' | 'failed'
  error?: string
}

interface TogetherModelDeployParams {
  modelId: string
  endpointName?: string
  instanceType?: string
  minInstances?: number
  maxInstances?: number
}

interface TogetherModelDeployResponse {
  endpointId: string
  endpointName: string
  status: 'deploying' | 'ready' | 'failed'
  modelId: string
  error?: string
}

interface TogetherJobStatus {
  jobId: string
  type: 'model_upload' | 'model_deploy'
  status: 'Queued' | 'Running' | 'Complete' | 'Failed'
  statusUpdates: Array<{
    status: string
    message: string
    timestamp: string
  }>
  error?: string
}

export class TogetherAIService {
  private apiKey: string
  private baseUrl = 'https://api.together.xyz/v1'
  private replicateService: ReplicateService | null = null

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TOGETHER_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('Together AI API key is required')
    }
    
    // Initialize Replicate service for Pro models only on server side
    try {
      // Check if we're on the server side and have the Replicate API token
      if (typeof window === 'undefined' && process.env.REPLICATE_API_TOKEN) {
        this.replicateService = new ReplicateService()
        console.log('✅ Replicate service initialized for Pro models')
      } else {
        console.log('ℹ️ Replicate service not available (client-side or missing token)')
      }
    } catch (error) {
      console.warn('Replicate service not available for Pro models:', error)
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
      const model = params.model || 'black-forest-labs/FLUX.1-schnell-Free'
      
      // Check if this model should use Replicate
      if (this.shouldUseReplicate(model)) {
        console.log(`🔄 Routing ${model} to Replicate`)
        return await this.generateWithReplicate(params)
      }
      
      // Use LoRA model if LoRAs are specified
      const togetherModel = params.imageLoras && params.imageLoras.length > 0 
        ? 'black-forest-labs/FLUX.1-dev-lora'
        : model
      
      console.log(`🔄 Using Together AI for ${togetherModel}`)
      
      const requestBody: any = {
        prompt: params.prompt,
        model: togetherModel,
        width: params.width || width,
        height: params.height || height,
        steps: params.steps || (params.imageLoras?.length ? 28 : 3), // More steps for LoRA
        seed: params.seed,
        n: 1,
        response_format: 'url'
      }

      // Add LoRA parameters if specified
      if (params.imageLoras && params.imageLoras.length > 0) {
        requestBody.image_loras = params.imageLoras.map(lora => ({
          path: lora.path,
          scale: lora.scale || 1.0
        }))
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
        let errorMessage = errorData.error?.message || `API request failed: ${response.status}`
        
        // We no longer override specific errors like HeaderTooLarge with custom "corruption" messages.
        // Let the original error from the service pass through.
        if (errorMessage.includes('HeaderTooLarge') || errorMessage.includes('Error while deserializing header')) {
          // Potentially log that a known "bad header" error occurred for internal tracking
          console.warn(`Together AI returned an error indicative of model header issues: ${errorMessage}`);
        }
        
        return {
          status: 'failed' as const,
          error: errorMessage,
          id: ''
        }
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

  // Generate image using Replicate for Pro models
  private async generateWithReplicate(params: GenerateImageParams): Promise<GenerateImageResponse> {
    try {
      if (!this.replicateService) {
        // Fallback to Together AI if Replicate is not available
        console.warn('⚠️ Replicate service not available, falling back to Together AI')
        
        // Try to use a similar model on Together AI
        const fallbackModel = params.model?.includes('1.1') 
          ? 'black-forest-labs/FLUX.1-dev'  // Use dev as fallback for 1.1 pro
          : 'black-forest-labs/FLUX.1-dev'  // Use dev as fallback for regular pro
        
        console.log(`🔄 Using fallback model: ${fallbackModel}`)
        
        return await this.generateImage({
          ...params,
          model: fallbackModel
        })
      }

      const model = params.model || 'black-forest-labs/FLUX.1-schnell-Free'
      const replicateModelId = this.getReplicateModelId(model)
      
      if (!replicateModelId) {
        throw new Error(`No Replicate model mapping found for ${model}`)
      }

      console.log(`🎨 Using Replicate model: ${replicateModelId}`)

      // Use the ReplicateService's public method
      const result = await this.replicateService.generateWithBaseModel({
        model: replicateModelId,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        seed: params.seed,
        width: params.width,
        height: params.height
      })

      // Convert ReplicateGenerationResponse to GenerateImageResponse
      return {
        id: result.id,
        status: result.status === 'completed' ? 'completed' : result.status === 'failed' ? 'failed' : 'processing',
        images: result.images,
        error: result.error
      }

    } catch (error) {
      console.error('❌ Replicate generation error:', error)
      return {
        id: `replicate_err_${Date.now()}`,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Replicate generation failed'
      }
    }
  }

  // Upload custom model to Together.ai platform
  async uploadCustomModel(params: TogetherModelUploadParams): Promise<TogetherModelUploadResponse> {
    try {
      const requestBody: any = {
        model_name: params.modelName,
        model_source: params.modelSource,
        description: params.description || `Custom model: ${params.modelName}`
      }

      // Add HuggingFace token if provided
      if (params.hfToken) {
        requestBody.hf_token = params.hfToken
      }

      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `Model upload failed: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        jobId: data.data.job_id,
        modelId: data.data.model_id,
        modelName: data.data.model_name,
        status: 'processing'
      }

    } catch (error) {
      console.error('Together AI model upload error:', error)
      return {
        jobId: '',
        modelId: '',
        modelName: params.modelName,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  // Check job status (upload or deployment)
  async getJobStatus(jobId: string): Promise<TogetherJobStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Job status check failed: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        jobId: data.job_id,
        type: data.type,
        status: data.status,
        statusUpdates: data.status_updates || [],
        error: data.status === 'Failed' ? 'Job failed' : undefined
      }

    } catch (error) {
      console.error('Together AI job status check error:', error)
      return {
        jobId,
        type: 'model_upload',
        status: 'Failed',
        statusUpdates: [],
        error: error instanceof Error ? error.message : 'Status check failed'
      }
    }
  }

  // Deploy uploaded model as dedicated endpoint
  async deployModel(params: TogetherModelDeployParams): Promise<TogetherModelDeployResponse> {
    try {
      const requestBody = {
        model_id: params.modelId,
        endpoint_name: params.endpointName || `endpoint-${params.modelId}`,
        instance_type: params.instanceType || 'gpu-small',
        min_instances: params.minInstances || 1,
        max_instances: params.maxInstances || 1
      }

      const response = await fetch(`${this.baseUrl}/endpoints`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `Model deployment failed: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        endpointId: data.endpoint_id,
        endpointName: data.endpoint_name,
        status: 'deploying',
        modelId: params.modelId
      }

    } catch (error) {
      console.error('Together AI model deployment error:', error)
      return {
        endpointId: '',
        endpointName: '',
        status: 'failed',
        modelId: params.modelId,
        error: error instanceof Error ? error.message : 'Deployment failed'
      }
    }
  }

  // Enhanced generateWithLoRA that supports both HuggingFace and Together.ai custom models
  async generateWithLoRA(params: {
    prompt: string
    loraPath: string  // HuggingFace repository path OR Together.ai model ID
    loraScale?: number
    triggerWord?: string
    width?: number
    height?: number
    steps?: number
    aspectRatio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3'
    seed?: number
    useTogetherModel?: boolean  // Flag to indicate if this is a Together.ai custom model
  }): Promise<GenerateImageResponse> {
    try {
      console.log('🎯 LoRA Generation Request:', {
        originalPrompt: params.prompt,
        loraPath: params.loraPath,
        triggerWord: params.triggerWord,
        useTogetherModel: params.useTogetherModel
      })

      // Enhance prompt with trigger word if provided
      const enhancedPrompt = params.triggerWord 
        ? `${params.triggerWord}, ${params.prompt}`.replace(/^,\s*/, '').replace(/,\s*,/g, ',')
        : params.prompt

      console.log('✨ Enhanced prompt:', enhancedPrompt)

      // Handle different model sources
      let formattedLoraPath = params.loraPath;
      
      if (params.useTogetherModel) {
        // For Together.ai custom models, use the model ID directly
        formattedLoraPath = params.loraPath;
        console.log('🔧 Using Together.ai custom model:', formattedLoraPath);
      } else {
        // For HuggingFace models, Together.ai API expects "huggingface.co/owner/repo"
        if (params.loraPath.startsWith('https://huggingface.co/')) {
          // Already a full URL, extract the relevant part "huggingface.co/owner/repo"
          const parts = params.loraPath.split('/');
          const hfIndex = parts.indexOf('huggingface.co');
          if (hfIndex !== -1 && parts.length > hfIndex + 2) {
            formattedLoraPath = `${parts[hfIndex]}/${parts[hfIndex + 1]}/${parts[hfIndex + 2]}`;
          } else {
            // Fallback or error if format is unexpected, but for now, try to use as is if it contains huggingface.co
            formattedLoraPath = params.loraPath.includes('huggingface.co') ? params.loraPath : `huggingface.co/${params.loraPath}`;
          }
        } else if (params.loraPath.includes('/')) {
          // Assumed to be in "owner/repo" format
          formattedLoraPath = `huggingface.co/${params.loraPath}`;
        } else {
          // Should not happen if loraPath is always owner/repo or a URL
          // As a fallback, assume it might be just a repo name missing owner, which is unlikely for HF
          // For safety, prefixing, but this case needs review based on actual inputs
          console.warn(`Unusual loraPath format for HuggingFace: ${params.loraPath}. Prefixing with huggingface.co/`);
          formattedLoraPath = `huggingface.co/${params.loraPath}`;
        }
        // Remove trailing slash if present, as API might be sensitive
        if (formattedLoraPath.endsWith('/')) {
          formattedLoraPath = formattedLoraPath.slice(0, -1);
        }
        console.log('🤗 Using HuggingFace LoRA path for API:', formattedLoraPath);
      }

      const result = await this.generateImage({
        prompt: enhancedPrompt,
        width: params.width,
        height: params.height,
        steps: params.steps || 28, // Default to higher steps for LoRA
        aspectRatio: params.aspectRatio,
        seed: params.seed,
        imageLoras: [{
          path: formattedLoraPath,
          scale: params.loraScale || 1.0
        }]
      })

      console.log('🎨 LoRA Generation Result:', {
        status: result.status,
        hasImages: !!result.images?.length,
        error: result.error
      })

      return result

    } catch (error) {
      console.error('❌ LoRA Generation Error:', error)
      return {
        id: `lora_err_${Date.now()}`,
        status: 'failed',
        error: error instanceof Error ? error.message : 'LoRA generation failed'
      }
    }
  }

  // Train LoRA model using uploaded images
  async trainLoRA(params: TrainLoRAParams): Promise<TrainLoRAResponse> {
    try {
      // NOTE: Together AI's fine-tuning API is primarily designed for text models (LLMs),
      // not image models like FLUX. Image model LoRA training is not currently supported
      // through their standard fine-tuning API.
      
      // For now, we'll return a descriptive error explaining the limitation
      console.warn('Together AI fine-tuning API does not currently support FLUX/image model LoRA training')
      
      return {
        id: `unsupported_${Date.now()}`,
        status: 'failed',
        name: params.name,
        error: 'Together AI fine-tuning currently supports text models (LLMs) only. FLUX LoRA training is not available through their fine-tuning API. Consider using their image generation endpoints with existing FLUX models instead.'
      }

      // The code below shows what FLUX LoRA training would look like if it were supported:
      /*
      const requestBody = {
        model_type: 'lora',
        name: params.name,
        description: params.description || `Custom LoRA model: ${params.name}`,
        base_model: params.baseModel || 'black-forest-labs/FLUX.1-dev',
        trigger_word: params.triggerWord || params.name.toLowerCase().replace(/\s+/g, '_'),
        training_type: 'full',
        hyperparameters: {
          learning_rate: params.learningRate || 0.0002,
          epochs: params.epochs || 100,
          batch_size: params.batchSize || 1,
          resolution: 1024,
          gradient_accumulation_steps: 1,
        },
        training_data: params.trainingImages.map((img, index) => ({
          image_url: img.url,
          caption: img.caption || `${params.triggerWord || params.name} person`,
        }))
      }

      // Together AI uses client.fine_tuning.create(), not direct API calls
      const response = await fetch(`${this.baseUrl}/fine-tuning/jobs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `Training API request failed: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        id: data.id,
        status: data.status as 'queued' | 'training' | 'completed' | 'failed',
        name: params.name,
        progress: 0,
        estimatedTimeRemaining: 1800 // 30 minutes estimate
      }
      */

    } catch (error) {
      console.error('Together AI training error:', error)
      return {
        id: `train_err_${Date.now()}`,
        status: 'failed',
        name: params.name,
        error: error instanceof Error ? error.message : 'Training failed'
      }
    }
  }

  // Check training job status
  async getTrainingStatus(jobId: string): Promise<TrainLoRAResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/fine-tuning/jobs/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`)
      }

      const data = await response.json()
      
      return {
        id: data.id,
        status: data.status as 'queued' | 'training' | 'completed' | 'failed',
        name: data.name || 'Unknown',
        progress: this.calculateProgress(data.status, data.created_at),
        estimatedTimeRemaining: this.calculateTimeRemaining(data.status, data.created_at),
        error: data.error?.message
      }

    } catch (error) {
      console.error('Training status check error:', error)
      return {
        id: jobId,
        status: 'failed',
        name: 'Unknown',
        error: error instanceof Error ? error.message : 'Status check failed'
      }
    }
  }

  // Batch generation support
  async batchGenerateImages(params: BatchGenerateParams): Promise<BatchGenerateResponse> {
    const batchId = `batch_${Date.now()}`
    const results: BatchGenerateResponse['results'] = []
    const batchSize = params.batchSize || 3 // Process in smaller batches to avoid timeouts
    
    try {
      for (let i = 0; i < params.prompts.length; i += batchSize) {
        const promptBatch = params.prompts.slice(i, i + batchSize)
        
        const batchPromises = promptBatch.map(async (prompt) => {
          try {
            const result = await this.generateImage({
              prompt,
              model: params.model,
              width: params.width,
              height: params.height,
              steps: params.steps,
              aspectRatio: params.aspectRatio
            })

            if (result.status === 'completed' && result.images?.[0]) {
              return {
                prompt,
                image: result.images[0]
              }
            } else {
              return {
                prompt,
                error: result.error || 'Generation failed'
              }
            }
          } catch (error) {
            return {
              prompt,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })

        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
      }

      return {
        batchId,
        status: 'completed',
        results,
        completedCount: results.filter(r => r.image).length,
        totalCount: params.prompts.length
      }

    } catch (error) {
      return {
        batchId,
        status: 'failed',
        results,
        completedCount: results.filter(r => r.image).length,
        totalCount: params.prompts.length
      }
    }
  }

  // Helper methods for training progress calculation
  private calculateProgress(status: string, createdAt?: string): number {
    if (status === 'completed') return 100
    if (status === 'failed') return 0
    if (status === 'queued') return 5
    
    if (status === 'training' && createdAt) {
      const elapsed = Date.now() - new Date(createdAt).getTime()
      const estimatedTotal = 1800000 // 30 minutes in milliseconds
      return Math.min(95, 10 + (elapsed / estimatedTotal) * 85)
    }
    
    return 10
  }

  private calculateTimeRemaining(status: string, createdAt?: string): number {
    if (status === 'completed' || status === 'failed') return 0
    if (status === 'queued') return 1800 // 30 minutes
    
    if (status === 'training' && createdAt) {
      const elapsed = Date.now() - new Date(createdAt).getTime()
      const estimatedTotal = 1800000 // 30 minutes in milliseconds
      return Math.max(0, Math.floor((estimatedTotal - elapsed) / 1000))
    }
    
    return 1800
  }

  // Get available FLUX models
  getAvailableModels(): Array<{ id: string; name: string; description: string; free?: boolean; provider?: string; replicateModel?: string }> {
    return [
      {
        id: 'black-forest-labs/FLUX.1-schnell-Free',
        name: 'FLUX.1 Schnell (Free)',
        description: 'Fast, free FLUX model - perfect for testing',
        free: true,
        provider: 'together'
      },
      {
        id: 'black-forest-labs/FLUX.1-schnell',
        name: 'FLUX.1 Schnell (Turbo)',
        description: 'Ultra-fast FLUX model with superior performance',
        provider: 'together'
      },
      {
        id: 'black-forest-labs/FLUX.1-dev',
        name: 'FLUX.1 Dev',
        description: 'Higher quality FLUX model for better results',
        provider: 'together'
      },
      {
        id: 'black-forest-labs/FLUX.1-pro',
        name: 'FLUX.1 Pro',
        description: 'Premium FLUX model for highest quality (via Replicate)',
        provider: 'replicate',
        replicateModel: 'black-forest-labs/flux-pro'
      },
      {
        id: 'black-forest-labs/FLUX1.1-pro',
        name: 'FLUX 1.1 Pro',
        description: 'Latest premium model with 3x faster generation (via Replicate)',
        provider: 'replicate',
        replicateModel: 'black-forest-labs/flux-1.1-pro'
      }
    ]
  }

  // Helper method to determine if a model should use Replicate
  private shouldUseReplicate(modelId: string): boolean {
    const model = this.getAvailableModels().find(m => m.id === modelId)
    return model?.provider === 'replicate'
  }

  // Helper method to get the Replicate model ID for a Together AI model
  private getReplicateModelId(modelId: string): string | null {
    const modelMap: Record<string, string> = {
      'black-forest-labs/FLUX.1-pro': 'black-forest-labs/flux-pro',
      'black-forest-labs/FLUX1.1-pro': 'black-forest-labs/flux-1.1-pro'
    }
    return modelMap[modelId] || null
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