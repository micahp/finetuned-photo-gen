import { ReplicateService } from './replicate-service'
import { HuggingFaceService } from './huggingface-service'
import { ZipCreationService } from './zip-creation-service'
import { TrainingDebugger, TrainingStage } from './training-debug'
import { TrainingStatusResolver, type UnifiedTrainingStatus, type StatusSources } from './training-status-resolver'

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
  
  // Track ongoing uploads to prevent duplicates
  public static ongoingUploads = new Set<string>()
  // Track completed uploads to avoid re-upload
  public static completedUploads = new Set<string>()

  constructor(
    replicateService?: ReplicateService,
    huggingfaceService?: HuggingFaceService,
    zipService?: ZipCreationService
  ) {
    this.replicate = replicateService || new ReplicateService()
    this.huggingface = huggingfaceService || new HuggingFaceService()
    this.zipService = zipService || new ZipCreationService()
  }

  /**
   * Start the complete LoRA training workflow with debugging
   */
  async startTraining(params: StartTrainingParams, customTrainingId?: string): Promise<{ trainingId: string; zipFilename: string; status: TrainingStatus; destinationModelId?: string }> {
    const trainingId = customTrainingId || `training_${Date.now()}_${Math.random().toString(36).substring(7)}`
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
      
      // Use the injected zip service instead of creating a new instance
      const zipResult = await this.zipService.createTrainingZip(params.trainingImages)
      
      if (!zipResult || !zipResult.success) {
        throw new Error(`ZIP creation failed: ${zipResult?.error || 'Unknown ZIP creation error'}`)
      }

      this.debugger.endStage(TrainingStage.ZIP_CREATION, 'ZIP creation completed', {
        zipUrl: zipResult.zipUrl,
        zipFilename: zipResult.zipFilename,
        imageCount: zipResult.imageCount,
        totalSize: zipResult.totalSize
      })

      // Step 2: Start Replicate training with ZIP URL
      this.debugger.startStage(TrainingStage.REPLICATE_TRAINING, 'Starting Replicate training')
      
      const replicateResponse = await this.replicate.startTraining({
        modelName: params.modelName,
        triggerWord: params.triggerWord,
        trainingImages: params.trainingImages, // Keep for compatibility
        zipUrl: zipResult.zipUrl || '', // Ensure string type, fallback to empty string
        baseModel: params.baseModel, // Pass the base model parameter
        steps: params.steps,
        learningRate: params.learningRate,
        loraRank: params.loraRank,
      })

      if (!replicateResponse || replicateResponse.status === 'failed') {
        throw new Error(replicateResponse?.error || 'Failed to start Replicate training')
      }

      this.debugger.endStage(TrainingStage.REPLICATE_TRAINING, 'Replicate training started', {
        trainingId: replicateResponse.id, // Use 'id' property from response
        status: replicateResponse.status
      })

      // Map Replicate status to our training status
      const mappedStatus = this.mapReplicateStatus(replicateResponse.status)

      // Return training result with zip filename for database storage
      return {
        trainingId: replicateResponse.id, // Use 'id' property from response
        zipFilename: zipResult.zipFilename || '', // Include empty filename for failed cases
        destinationModelId: replicateResponse.destinationModelId, // Include destination model ID
        status: {
          id: replicateResponse.id,
          status: mappedStatus,
          progress: 0,
          stage: 'Training started successfully',
          debugData: this.debugger.getDebugSummary()
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Training workflow error:', errorMessage)
      
      const errorStatus: TrainingStatus = {
        id: trainingId,
        status: 'failed',
        progress: 0,
        stage: 'Training failed to start',
        error: errorMessage,
        debugData: this.debugger?.getDebugSummary()
      }

      return {
        trainingId: trainingId,
        zipFilename: '', // Empty filename for failed cases
        destinationModelId: undefined, // No destination model for failed training
        status: errorStatus
      }
    }
  }

  /**
   * Check training status and handle workflow progression with debugging
   */
  async getTrainingStatus(trainingId: string, modelName: string, allowUpload: boolean = false): Promise<TrainingStatus> {
    if (!this.debugger) {
      this.debugger = new TrainingDebugger(trainingId)
    }

    try {
      // Get fresh status from Replicate
      const replicateStatus = await this.replicate.getTrainingStatus(trainingId)
      
      this.debugger.log('info', TrainingStage.REPLICATE_TRAINING, 'Retrieved Replicate status', {
        status: replicateStatus.status,
        trainingId
      })

      // Get database imports
      const { prisma } = await import('@/lib/db')
      
      // Get user model status
      const userModel = await prisma.userModel.findFirst({
        where: { externalTrainingId: trainingId }
      })

      // Parse logs for progress information
      const logProgress = TrainingStatusResolver.parseTrainingLogs(replicateStatus.logs)

      // Map Replicate status to our TrainingStatus
      if (replicateStatus.status === 'succeeded') {
        // For newly completed training, mark as ready immediately (no HF upload)
        if (!userModel?.huggingfaceRepo) {
          // Update model to ready status
          if (userModel?.id) {
            await prisma.userModel.update({
              where: { id: userModel.id },
              data: {
                status: 'ready',
                loraReadyForInference: true,
                trainingCompletedAt: new Date(),
              }
            })
          }

          return {
            id: trainingId,
            status: 'completed',
            progress: 100,
            stage: 'Training completed successfully',
            debugData: this.debugger.getDebugSummary()
          }
        }
        
        // Legacy models with existing HF repos
        return {
          id: trainingId,
          status: 'completed',
          progress: 100,
          stage: 'Training completed successfully and model uploaded to HuggingFace',
          huggingFaceRepo: userModel.huggingfaceRepo,
          debugData: this.debugger.getDebugSummary()
        }
      }

      // Handle other Replicate statuses (training, failed, etc)
      const mappedStatus = this.mapReplicateStatus(replicateStatus.status)
      
      if (replicateStatus.status === 'failed') {
        await this.updateJobQueueStatus(trainingId, 'failed', replicateStatus.error)
        
        return {
          id: trainingId,
          status: 'failed',
          progress: 0,
          stage: 'Training failed',
          error: replicateStatus.error || 'Training failed on Replicate',
          debugData: this.debugger.getDebugSummary()
        }
      }

      // Training still in progress - use log-based progress
      return {
        id: trainingId,
        status: mappedStatus,
        progress: logProgress.progress,
        stage: logProgress.stageDescription,
        debugData: this.debugger.getDebugSummary()
      }

    } catch (error) {
      const trainingError = this.debugger.logError(TrainingStage.REPLICATE_TRAINING, error, 'Failed to get training status')
      console.error('Error getting training status:', error)
      
      return {
        id: trainingId,
        status: 'failed',
        progress: 0,
        stage: 'Failed to get training status',
        error: trainingError?.message || (error instanceof Error ? error.message : 'Unknown error'),
        debugData: this.debugger.getDebugSummary()
      }
    }
  }

  /**
   * Verify HuggingFace model existence and update database status accordingly
   */
  private async verifyAndUpdateHuggingFaceStatus(userModel: any, trainingId: string): Promise<any> {
    try {
      const { prisma } = await import('@/lib/db')
      
      // If model has a HuggingFace repo, verify it exists
      if (userModel.huggingfaceRepo) {
        try {
          const repoStatus = await this.huggingface.getRepoStatus(userModel.huggingfaceRepo)
          
          // If model exists and is ready, but database doesn't reflect this
          if (repoStatus.modelReady && (userModel.status !== 'ready' || !userModel.loraReadyForInference)) {
            console.log(`Detected existing HuggingFace model ${userModel.huggingfaceRepo}, updating database status`)
            
            const updatedModel = await prisma.userModel.update({
              where: { id: userModel.id },
              data: {
                status: 'ready',
                huggingfaceStatus: 'ready',
                loraReadyForInference: true,
                trainingCompletedAt: userModel.trainingCompletedAt || new Date()
              }
            })
            
            return updatedModel
          }
          
          return userModel
          
        } catch (error) {
          // HuggingFace model doesn't exist, clear database reference
          console.log(`HuggingFace model ${userModel.huggingfaceRepo} not found, clearing database reference`)
          
          const updatedModel = await prisma.userModel.update({
            where: { id: userModel.id },
            data: {
              huggingfaceRepo: null,
              huggingfaceStatus: null,
              loraReadyForInference: false
            }
          })
          
          return updatedModel
        }
      }
      
      return userModel
      
    } catch (error) {
      console.error('Error verifying HuggingFace status:', error)
      return userModel
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
        },
        {
          id: 'stability-ai/sdxl',
          name: 'Stable Diffusion XL',
          description: 'High-resolution Stable Diffusion model'
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

  /**
   * Update job queue status based on external training status
   */
  private async updateJobQueueStatus(trainingId: string, status: string, errorMessage?: string): Promise<void> {
    try {
      const { prisma } = await import('@/lib/db')
      
      // Find the job with this external training ID
      const job = await prisma.jobQueue.findFirst({
        where: {
          jobType: 'model_training',
          payload: {
            path: ['externalTrainingId'],
            equals: trainingId
          }
        }
      })
      
      if (!job) {
        console.warn(`No job found for external training ID: ${trainingId}`)
        return
      }
      
      // Map unified status to job status
      let jobStatus = status
      switch (status) {
        case 'starting':
        case 'training':
          jobStatus = 'running'
          break
        case 'uploading':
          // For uploading status, check if it needs upload or is actively uploading
          // If it needs upload, keep as 'succeeded' to indicate Replicate training is done
          // If actively uploading, use 'running'
          jobStatus = 'succeeded' // Default to succeeded since Replicate training is done
          break
        case 'completed':
          // Use 'succeeded' to match what the status resolver expects
          // The resolver will map this to 'completed' when HuggingFace upload is done
          jobStatus = 'succeeded'
          break
        case 'failed':
          jobStatus = 'failed'
          break
        default:
          jobStatus = 'running'
          break
      }
      
      // Only update if status changed
      if (job.status !== jobStatus) {
        console.log(`🔄 Updating job ${job.id} status: ${job.status} → ${jobStatus}`)
        
        await prisma.jobQueue.update({
          where: { id: job.id },
          data: {
            status: jobStatus,
            errorMessage: errorMessage || job.errorMessage,
            completedAt: ['succeeded', 'failed'].includes(jobStatus) ? new Date() : job.completedAt
          }
        })
      }
      
    } catch (error) {
      console.error('Failed to update job queue status:', error)
    }
  }

  /**
   * Check if a HuggingFace model already exists for a training
   */
  private async checkForExistingHuggingFaceModel(trainingId: string, modelName: string): Promise<string | null> {
    try {
      const { prisma } = await import('@/lib/db')
      
      // Find the model with this external training ID
      const model = await prisma.userModel.findFirst({
        where: {
          externalTrainingId: trainingId
        }
      })
      
      if (model?.huggingfaceRepo) {
        // Verify the HuggingFace model actually exists
        try {
          const repoStatus = await this.huggingface.getRepoStatus(model.huggingfaceRepo)
          if (repoStatus.modelReady) {
            return model.huggingfaceRepo
          }
        } catch (error) {
          // Model doesn't exist on HuggingFace, clear the database reference
          console.log(`HuggingFace model ${model.huggingfaceRepo} not found, clearing database reference`)
          await prisma.userModel.update({
            where: { id: model.id },
            data: {
              huggingfaceRepo: null,
              huggingfaceStatus: null,
              loraReadyForInference: false
            }
          })
          return null
        }
      }
      
      return null
    } catch (error) {
      console.error('Error checking for existing HuggingFace model:', error)
      return null
    }
  }

  /**
   * Map Replicate status to our training status
   */
  private mapReplicateStatus(status: string): TrainingStatus['status'] {
    switch (status) {
      case 'starting':
        return 'starting'
      case 'processing':
        return 'training'
      case 'succeeded':
        return 'completed'
      case 'failed':
      case 'canceled':
        return 'failed'
      default:
        return 'training'
    }
  }

  /**
   * Manually trigger HuggingFace upload for a completed training
   * This is used for retry upload functionality
   */
  async triggerHuggingFaceUpload(
    trainingId: string, 
    modelName: string, 
    waitForCompletion: boolean = false
  ): Promise<TrainingStatus> {
    // HuggingFace upload functionality has been removed
    // Models are now marked as ready immediately after Replicate training succeeds
    console.log(`⚠️ HuggingFace upload functionality has been disabled. Model ${modelName} should already be ready.`)
    
    return {
      id: trainingId,
      status: 'completed',
      progress: 100,
      stage: 'Training completed successfully',
      error: 'HuggingFace upload is no longer supported. Model is ready for use.'
    }
  }
} 