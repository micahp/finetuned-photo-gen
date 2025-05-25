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
  
  // Track ongoing uploads to prevent duplicates
  private static ongoingUploads = new Set<string>()
  // Track completed uploads to avoid re-upload
  private static completedUploads = new Set<string>()

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
  async getTrainingStatus(trainingId: string, modelName: string, allowUpload: boolean = false): Promise<TrainingStatus> {
    // Initialize debugger if not exists (for status checks)
    if (!this.debugger) {
      this.debugger = new TrainingDebugger(trainingId)
    }

    try {
      // Check Replicate training status
      const replicateStatus = await this.replicate.getTrainingStatus(trainingId)
      
      // Update job queue status to match external training status
      await this.updateJobQueueStatus(trainingId, replicateStatus.status, replicateStatus.error)
      
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
          // Check if upload was already completed for this training
          if (TrainingService.completedUploads.has(trainingId)) {
            return {
              id: trainingId,
              status: 'completed',
              progress: 100,
              stage: 'Training completed successfully and model uploaded to HuggingFace',
              logs: replicateStatus.logs,
              debugData: this.debugger.getDebugSummary()
            }
          }
          
          // Check if upload is currently in progress
          if (TrainingService.ongoingUploads.has(trainingId)) {
            return {
              id: trainingId,
              status: 'uploading',
              progress: 95,
              stage: 'Training completed, uploading to HuggingFace...',
              logs: replicateStatus.logs,
              debugData: this.debugger.getDebugSummary()
            }
          }
          
          // Only proceed with upload if explicitly allowed
          if (allowUpload) {
            return await this.handleTrainingCompletion(trainingId, modelName, replicateStatus)
          } else {
            // Training succeeded but upload not initiated - return status indicating upload needed
            return {
              id: trainingId,
              status: 'uploading', // Use uploading status to indicate transition state
              progress: 90,
              stage: 'Training completed successfully, ready for upload to HuggingFace',
              logs: replicateStatus.logs,
              debugData: this.debugger.getDebugSummary()
            }
          }

        case 'failed':
          return {
            id: trainingId,
            status: 'failed',
            progress: 0,
            stage: 'Training failed',
            error: replicateStatus.error || 'Replicate training failed',
            logs: replicateStatus.logs,
            debugData: this.debugger.getDebugSummary()
          }

        default:
          return {
            id: trainingId,
            status: 'starting',
            progress: 5,
            stage: `Unknown status: ${replicateStatus.status}`,
            logs: replicateStatus.logs,
            debugData: this.debugger.getDebugSummary()
          }
      }

    } catch (error) {
      const trainingError = this.debugger?.logError(
        TrainingStage.REPLICATE_TRAINING,
        error,
        'Failed to check training status'
      )

      console.error('Training status check error:', error)
      
      return {
        id: trainingId,
        status: 'failed',
        progress: 0,
        stage: 'Failed to check training status',
        error: error instanceof Error ? error.message : 'Status check failed',
        debugData: this.debugger?.getDebugSummary()
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

    // Check if upload is already in progress or completed
    if (TrainingService.ongoingUploads.has(trainingId)) {
      return {
        id: trainingId,
        status: 'uploading',
        progress: 95,
        stage: 'Training completed, uploading to HuggingFace...',
        debugData: this.debugger.getDebugSummary()
      }
    }

    if (TrainingService.completedUploads.has(trainingId)) {
      return {
        id: trainingId,
        status: 'completed',
        progress: 100,
        stage: 'Training completed successfully and model uploaded to HuggingFace',
        debugData: this.debugger.getDebugSummary()
      }
    }

    // Mark upload as in progress
    TrainingService.ongoingUploads.add(trainingId)

    try {
      this.debugger.startStage(TrainingStage.HUGGINGFACE_UPLOAD, 'Starting HuggingFace upload')
      
      console.log(`🔍 TRAINING COMPLETION DEBUG:`, {
        trainingId,
        modelName,
        modelNameType: typeof modelName,
        modelNameLength: modelName?.length,
        replicateOutput: replicateStatus.output,
        replicateOutputType: typeof replicateStatus.output,
        replicateOutputArray: Array.isArray(replicateStatus.output),
      })
      
      console.log(`Training completed for ${modelName}, uploading to HuggingFace...`)

      // Extract model path from Replicate output with proper type handling
      let modelPath: string = '';
      
      if (typeof replicateStatus.output === 'string') {
        // Output is a single URL string
        modelPath = replicateStatus.output;
      } else if (Array.isArray(replicateStatus.output) && replicateStatus.output.length > 0) {
        // Output is an array of URLs, take the first one
        const firstOutput = replicateStatus.output[0];
        if (typeof firstOutput === 'string') {
          modelPath = firstOutput;
        } else {
          throw new Error(`Invalid output format: First array item is not a string (type: ${typeof firstOutput})`);
        }
      } else if (replicateStatus.output && typeof replicateStatus.output === 'object') {
        // Output might be an object with file information
        console.log(`🔍 Object output detected, keys: ${Object.keys(replicateStatus.output).join(', ')}`, replicateStatus.output);
        
        if (replicateStatus.output.url && typeof replicateStatus.output.url === 'string') {
          modelPath = replicateStatus.output.url;
        } else if (replicateStatus.output.file && typeof replicateStatus.output.file === 'string') {
          modelPath = replicateStatus.output.file;
        } else if (replicateStatus.output.weights && typeof replicateStatus.output.weights === 'string') {
          // Handle Replicate's weights URL format
          modelPath = replicateStatus.output.weights;
        } else {
          throw new Error(`Invalid output format: Object does not contain valid URL (keys: ${Object.keys(replicateStatus.output).join(', ')})`);
        }
      } else {
        throw new Error(`Invalid output format: Expected string, array, or object with URL, got ${typeof replicateStatus.output}: ${JSON.stringify(replicateStatus.output)}`);
      }

      if (!modelPath || !modelPath.trim()) {
        throw new Error('No valid model path extracted from Replicate output');
      }

      console.log(`📁 Extracted model path: ${modelPath} (type: ${typeof modelPath})`);

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
        modelPath: modelPath, // Now guaranteed to be a string
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
            modelPath: modelPath, // Use the same validated model path
            description: `Custom FLUX LoRA model: ${modelName} (Training ID: ${trainingId})`,
            tags: ['flux', 'lora', 'text-to-image', 'custom'],
            isPrivate: isPrivate,
          })
          
          if (retryResponse.status === 'completed') {
            // Mark upload as completed and remove from ongoing
            TrainingService.completedUploads.add(trainingId)
            TrainingService.ongoingUploads.delete(trainingId)
            
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

        // Remove from ongoing uploads on failure
        TrainingService.ongoingUploads.delete(trainingId)

        const error = this.debugger.logError(
          TrainingStage.HUGGINGFACE_UPLOAD,
          new Error(errorMessage),
          'HuggingFace upload failed after training completion'
        )

        // Training succeeded but upload failed - be specific about this
        return {
          id: trainingId,
          status: 'uploading', // Changed from 'failed' to 'uploading' to trigger retry UI
          progress: 90,
          stage: 'Training completed successfully, but HuggingFace upload failed',
          error: `Model training completed successfully, but failed to upload to HuggingFace: ${error instanceof Error ? error.message : 'Upload failed'}`,
          debugData: this.debugger.getDebugSummary()
        }
      }

      // Mark upload as completed and remove from ongoing
      TrainingService.completedUploads.add(trainingId)
      TrainingService.ongoingUploads.delete(trainingId)

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
      // Remove from ongoing uploads on error
      TrainingService.ongoingUploads.delete(trainingId)

      const trainingError = this.debugger.logError(
        TrainingStage.HUGGINGFACE_UPLOAD,
        error,
        'Failed to complete training workflow'
      )

      console.error('Error handling training completion:', error)
      
      // Training succeeded but upload failed - be specific about this
      return {
        id: trainingId,
        status: 'uploading', // Changed from 'failed' to 'uploading' to trigger retry UI
        progress: 90,
        stage: 'Training completed successfully, but HuggingFace upload failed',
        error: `Model training completed successfully, but failed to upload to HuggingFace: ${error instanceof Error ? error.message : 'Upload failed'}`,
        debugData: this.debugger.getDebugSummary()
      }
    }
  }

  /**
   * Manually trigger HuggingFace upload for a completed training
   * This is used for retry upload functionality
   */
  async triggerHuggingFaceUpload(trainingId: string, modelName: string): Promise<TrainingStatus> {
    try {
      // Get the current Replicate status
      const replicateStatus = await this.replicate.getTrainingStatus(trainingId)
      
      if (replicateStatus.status !== 'succeeded') {
        throw new Error(`Cannot upload model - Replicate training status is: ${replicateStatus.status}`)
      }

      // Force upload by calling handleTrainingCompletion with allowUpload = true
      return await this.handleTrainingCompletion(trainingId, modelName, replicateStatus)

    } catch (error) {
      console.error('Manual upload trigger error:', error)
      return {
        id: trainingId,
        status: 'failed',
        progress: 0,
        stage: 'Failed to trigger upload',
        error: error instanceof Error ? error.message : 'Upload trigger failed'
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
      
      // Map external status to job status
      let jobStatus = status
      switch (status) {
        case 'starting':
        case 'training':
          jobStatus = 'running'
          break
        case 'uploading':
          jobStatus = 'running' // Keep as running during upload
          break
        case 'completed':
          jobStatus = 'completed'
          break
        case 'failed':
          jobStatus = 'failed'
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
            completedAt: ['completed', 'failed'].includes(jobStatus) ? new Date() : job.completedAt
          }
        })
      }
      
    } catch (error) {
      console.error('Failed to update job queue status:', error)
    }
  }
} 