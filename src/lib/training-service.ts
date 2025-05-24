import { ReplicateService } from './replicate-service'
import { HuggingFaceService } from './huggingface-service'
import { ZipCreationService } from './zip-creation-service'
import { TrainingDebugger, TrainingStage } from './training-debug'

interface TrainingImage {
  id: string
  filename: string
  url: string
  size: number
}

interface StartTrainingParams {
  modelName: string
  triggerWord: string
  description?: string
  trainingImages: TrainingImage[]
  userId: string
  baseModel?: string
  steps?: number
  learningRate?: number
  loraRank?: number
  isPrivate?: boolean // Future feature: will be tied to subscription plans (free = public, premium = private)
}

interface TrainingStatus {
  id: string
  status: 'starting' | 'training' | 'uploading' | 'completed' | 'failed'
  progress: number
  stage: string
  estimatedTimeRemaining?: number
  huggingFaceRepo?: string
  error?: string
  logs?: string
  debugData?: any
}

export class TrainingService {
  private replicate: ReplicateService
  private huggingface: HuggingFaceService
  private zipService: ZipCreationService
  private debugger: TrainingDebugger | null = null

  constructor() {
    this.replicate = new ReplicateService()
    this.huggingface = new HuggingFaceService()
    this.zipService = new ZipCreationService()
  }

  /**
   * Start the complete LoRA training workflow with debugging
   */
  async startTraining(params: StartTrainingParams): Promise<{ trainingId: string; status: TrainingStatus }> {
    const trainingId = `training_${Date.now()}_${Math.random().toString(36).substring(7)}`
    this.debugger = new TrainingDebugger(trainingId)
    
    try {
      this.debugger.startStage(TrainingStage.INITIALIZING, 'Starting complete LoRA training workflow', {
        modelName: params.modelName,
        imageCount: params.trainingImages.length,
        userId: params.userId
      })

      console.log(`Starting LoRA training for model: ${params.modelName}`)

      // Step 1: Create ZIP file with training images
      this.debugger.startStage(TrainingStage.ZIP_CREATION, 'Creating training images ZIP file')
      
      const zipResult = await this.zipService.createTrainingZip(params.trainingImages)
      
      if (!zipResult.success) {
        throw new Error(`ZIP creation failed: ${zipResult.error}`)
      }

      this.debugger.endStage(TrainingStage.ZIP_CREATION, 'ZIP creation completed', {
        zipUrl: zipResult.zipUrl,
        imageCount: zipResult.imageCount,
        totalSize: zipResult.totalSize
      })

      // Step 2: Start Replicate training with ZIP URL
      this.debugger.startStage(TrainingStage.REPLICATE_TRAINING, 'Starting Replicate training')
      
      const replicateResponse = await this.replicate.startTraining({
        modelName: params.modelName,
        triggerWord: params.triggerWord,
        trainingImages: params.trainingImages, // Keep for compatibility
        zipUrl: zipResult.zipUrl, // New: ZIP URL for actual training
        steps: params.steps,
        learningRate: params.learningRate,
        loraRank: params.loraRank,
      })

      if (replicateResponse.status === 'failed') {
        throw new Error(replicateResponse.error || 'Failed to start Replicate training')
      }

      this.debugger.endStage(TrainingStage.REPLICATE_TRAINING, 'Replicate training started', {
        replicateId: replicateResponse.id,
        status: replicateResponse.status
      })

      const initialStatus: TrainingStatus = {
        id: trainingId,
        status: 'starting',
        progress: 5,
        stage: 'Training environment prepared, starting LoRA training',
        estimatedTimeRemaining: 1800, // 30 minutes
        debugData: this.debugger.getDebugSummary()
      }

      return {
        trainingId: replicateResponse.id, // Return Replicate ID for status checking
        status: initialStatus
      }

    } catch (error) {
      const trainingError = this.debugger?.logError(
        TrainingStage.INITIALIZING,
        error,
        'Failed to start training workflow'
      )

      console.error('Training service error:', error)
      
      const errorStatus: TrainingStatus = {
        id: trainingId,
        status: 'failed',
        progress: 0,
        stage: 'Failed to start training',
        error: error instanceof Error ? error.message : 'Unknown error',
        debugData: this.debugger?.getDebugSummary()
      }

      return {
        trainingId: trainingId,
        status: errorStatus
      }
    }
  }

  /**
   * Check training status and handle workflow progression with debugging
   */
  async getTrainingStatus(trainingId: string, modelName: string): Promise<TrainingStatus> {
    // Initialize debugger if not exists (for status checks)
    if (!this.debugger) {
      this.debugger = new TrainingDebugger(trainingId)
    }

    try {
      // Check Replicate training status
      const replicateStatus = await this.replicate.getTrainingStatus(trainingId)
      
      switch (replicateStatus.status) {
        case 'starting':
          return {
            id: trainingId,
            status: 'starting',
            progress: 10,
            stage: 'Preparing training environment',
            estimatedTimeRemaining: 1800,
            logs: replicateStatus.logs,
            debugData: this.debugger.getDebugSummary()
          }

        case 'processing':
          return {
            id: trainingId,
            status: 'training',
            progress: 40,
            stage: 'Training LoRA model (this may take 15-30 minutes)',
            estimatedTimeRemaining: 1200,
            logs: replicateStatus.logs,
            debugData: this.debugger.getDebugSummary()
          }

        case 'succeeded':
          // Training completed, now upload to HuggingFace
          return await this.handleTrainingCompletion(trainingId, modelName, replicateStatus)

        case 'failed':
        case 'canceled':
          // Enhanced error logging with detailed diagnosis
          const replicateError = replicateStatus.error || 'Training was canceled or failed'
          
          // Log comprehensive error details for debugging
          console.error('🔴 REPLICATE TRAINING FAILED - Full details:', {
            trainingId,
            replicateStatus: replicateStatus.status,
            errorMessage: replicateError,
            logs: replicateStatus.logs,
            inputUrl: replicateStatus.input?.input_images, // Check what URL Replicate tried to use
            allReplicateData: replicateStatus
          })
          
          // Analyze error type and provide specific guidance
          let enhancedError = replicateError
          if (replicateError.includes('400') || replicateError.includes('Bad Request')) {
            enhancedError = `ZIP file access error: ${replicateError}. This usually means the ZIP file URL is not publicly accessible to Replicate. Check R2 bucket permissions.`
          } else if (replicateError.includes('403') || replicateError.includes('Forbidden')) {
            enhancedError = `Access denied: ${replicateError}. The ZIP file exists but Replicate cannot access it due to permissions.`
          } else if (replicateError.includes('404') || replicateError.includes('Not Found')) {
            enhancedError = `ZIP file not found: ${replicateError}. The uploaded ZIP file URL is invalid or the file was deleted.`
          }
          
          const error = this.debugger.logError(
            TrainingStage.REPLICATE_TRAINING,
            new Error(enhancedError),
            'Replicate training failed',
            {
              originalError: replicateError,
              statusCode: replicateStatus.status,
              inputUrl: replicateStatus.input?.input_images,
              troubleshooting: {
                'URL_ACCESS_ERROR': 'Check if ZIP file URL is publicly accessible',
                'BUCKET_PERMISSIONS': 'Verify R2 bucket has public-read ACL',
                'CORS_CONFIGURATION': 'Ensure R2 bucket allows external access'
              }
            }
          )

          return {
            id: trainingId,
            status: 'failed',
            progress: 0,
            stage: 'Training failed',
            error: enhancedError,
            logs: replicateStatus.logs,
            debugData: this.debugger.getDebugSummary()
          }

        default:
          return {
            id: trainingId,
            status: 'training',
            progress: 20,
            stage: 'Training in progress',
            estimatedTimeRemaining: 1500,
            debugData: this.debugger.getDebugSummary()
          }
      }

    } catch (error) {
      const trainingError = this.debugger.logError(
        TrainingStage.REPLICATE_TRAINING,
        error,
        'Failed to check training status'
      )

      console.error('Error checking training status:', error)
      return {
        id: trainingId,
        status: 'failed',
        progress: 0,
        stage: 'Status check failed',
        error: trainingError.message,
        debugData: this.debugger.getDebugSummary()
      }
    }
  }

  /**
   * Handle training completion and upload to HuggingFace with debugging
   */
  private async handleTrainingCompletion(
    trainingId: string, 
    modelName: string, 
    replicateStatus: any,
    isPrivate: boolean = false // MVP: Public models for all users, private models will be a premium feature
  ): Promise<TrainingStatus> {
    if (!this.debugger) {
      this.debugger = new TrainingDebugger(trainingId)
    }

    try {
      this.debugger.startStage(TrainingStage.HUGGINGFACE_UPLOAD, 'Starting HuggingFace upload')
      
      console.log(`🔍 TRAINING COMPLETION DEBUG:`, {
        trainingId,
        modelName,
        modelNameType: typeof modelName,
        modelNameLength: modelName?.length,
        replicateOutput: replicateStatus.output
      })
      
      console.log(`Training completed for ${modelName}, uploading to HuggingFace...`)

      // Generate unique repository name to avoid conflicts
      const baseModelName = modelName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'trained-model'
      // Use a more unique timestamp format with milliseconds and a random suffix
      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const uniqueModelName = `${baseModelName}-${timestamp}-${randomSuffix}`

      console.log(`🤗 Creating unique HuggingFace repository: ${uniqueModelName} (original: ${modelName})`)

      // Upload to HuggingFace using existing service instance
      const uploadResponse = await this.huggingface.uploadModel({
        modelName: uniqueModelName, // Use unique name
        modelPath: replicateStatus.output || '', // Replicate output path
        description: `Custom FLUX LoRA model: ${modelName} (Training ID: ${trainingId})`,
        tags: ['flux', 'lora', 'text-to-image', 'custom'],
        isPrivate: isPrivate, // Use the provided privacy setting
      })

      if (uploadResponse.status === 'failed') {
        // Handle specific HuggingFace errors
        let errorMessage = uploadResponse.error || 'HuggingFace upload failed'
        
        if (errorMessage.includes('You already created this model repo') || errorMessage.includes('already exists')) {
          // Try with an additional random suffix - make it even more unique
          const extraRandomSuffix = Math.random().toString(36).substring(2, 10)
          const retryModelName = `${baseModelName}-${timestamp}-${randomSuffix}-${extraRandomSuffix}`
          
          console.log(`🔄 Repository exists, retrying with: ${retryModelName}`)
          
          const retryResponse = await this.huggingface.uploadModel({
            modelName: retryModelName,
            modelPath: replicateStatus.output || '',
            description: `Custom FLUX LoRA model: ${modelName} (Training ID: ${trainingId})`,
            tags: ['flux', 'lora', 'text-to-image', 'custom'],
            isPrivate: isPrivate,
          })
          
          if (retryResponse.status === 'completed') {
            // Use the retry result
            this.debugger.endStage(TrainingStage.HUGGINGFACE_UPLOAD, 'HuggingFace upload completed (retry)', {
              repoId: retryResponse.repoId,
              repoUrl: retryResponse.repoUrl
            })

            return {
              id: trainingId,
              status: 'completed',
              progress: 100,
              stage: 'Training completed successfully and model uploaded to HuggingFace',
              huggingFaceRepo: retryResponse.repoId,
              debugData: this.debugger.getDebugSummary()
            }
          } else {
            errorMessage = retryResponse.error || 'HuggingFace retry upload failed'
          }
        }

        const error = this.debugger.logError(
          TrainingStage.HUGGINGFACE_UPLOAD,
          new Error(errorMessage),
          'HuggingFace upload failed after training completion'
        )

        // Training succeeded but upload failed - be specific about this
        return {
          id: trainingId,
          status: 'failed',
          progress: 95,
          stage: 'Training completed successfully, but HuggingFace upload failed',
          error: `Model training completed successfully, but failed to upload to HuggingFace: ${errorMessage}`,
          debugData: this.debugger.getDebugSummary()
        }
      }

      this.debugger.endStage(TrainingStage.HUGGINGFACE_UPLOAD, 'HuggingFace upload completed', {
        repoId: uploadResponse.repoId,
        repoUrl: uploadResponse.repoUrl
      })

      this.debugger.startStage(TrainingStage.COMPLETION, 'Finalizing training workflow')
      this.debugger.endStage(TrainingStage.COMPLETION, 'Training workflow completed successfully')

      // Training and upload completed successfully
      return {
        id: trainingId,
        status: 'completed',
        progress: 100,
        stage: 'Training completed successfully and model uploaded to HuggingFace',
        huggingFaceRepo: uploadResponse.repoId,
        debugData: this.debugger.getDebugSummary()
      }

    } catch (error) {
      const trainingError = this.debugger.logError(
        TrainingStage.HUGGINGFACE_UPLOAD,
        error,
        'Failed to complete training workflow'
      )

      console.error('Error handling training completion:', error)
      
      // Training succeeded but upload failed - be specific about this
      return {
        id: trainingId,
        status: 'failed',
        progress: 90,
        stage: 'Training completed successfully, but HuggingFace upload failed',
        error: `Model training completed successfully, but failed to upload to HuggingFace: ${error instanceof Error ? error.message : 'Upload failed'}`,
        debugData: this.debugger.getDebugSummary()
      }
    }
  }

  /**
   * Cancel a training job with debugging
   */
  async cancelTraining(trainingId: string): Promise<boolean> {
    if (!this.debugger) {
      this.debugger = new TrainingDebugger(trainingId)
    }

    try {
      this.debugger.log('info', TrainingStage.REPLICATE_TRAINING, 'Canceling training job', { trainingId })
      
      const result = await this.replicate.cancelTraining(trainingId)
      
      if (result) {
        this.debugger.log('info', TrainingStage.REPLICATE_TRAINING, 'Training job canceled successfully')
      } else {
        this.debugger.log('warn', TrainingStage.REPLICATE_TRAINING, 'Failed to cancel training job')
      }
      
      return result
    } catch (error) {
      this.debugger.logError(TrainingStage.REPLICATE_TRAINING, error, 'Error canceling training')
      console.error('Error canceling training:', error)
      return false
    }
  }

  /**
   * Get available training options
   */
  getTrainingOptions() {
    return {
      providers: [
        {
          id: 'replicate',
          name: 'Replicate',
          description: 'Cloud GPU training with Replicate',
          estimatedTime: '15-30 minutes',
          cost: '$0.05-0.15 per training session'
        }
      ],
      baseModels: [
        {
          id: 'black-forest-labs/FLUX.1-dev',
          name: 'FLUX.1-dev',
          description: 'High-quality FLUX model for detailed images'
        }
      ],
      defaultSettings: {
        steps: 1000,
        learningRate: 1e-4,
        loraRank: 16,
        batchSize: 1,
        resolution: '512,768,1024'
      }
    }
  }

  /**
   * Validate training parameters
   */
  validateTrainingParams(params: StartTrainingParams): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!params.modelName || params.modelName.trim().length < 2) {
      errors.push('Model name must be at least 2 characters long')
    }

    if (!params.triggerWord || params.triggerWord.trim().length < 2) {
      errors.push('Trigger word must be at least 2 characters long')
    }

    if (!params.trainingImages || params.trainingImages.length < 3) {
      errors.push('At least 3 training images are required')
    }

    if (params.trainingImages && params.trainingImages.length > 20) {
      errors.push('Maximum 20 training images allowed')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
} 