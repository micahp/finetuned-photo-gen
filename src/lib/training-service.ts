import { ReplicateService } from './replicate-service'
import { HuggingFaceService } from './huggingface-service'

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
}

export class TrainingService {
  private replicate: ReplicateService
  private huggingface: HuggingFaceService

  constructor() {
    this.replicate = new ReplicateService()
    this.huggingface = new HuggingFaceService()
  }

  /**
   * Start the complete LoRA training workflow
   */
  async startTraining(params: StartTrainingParams): Promise<{ trainingId: string; status: TrainingStatus }> {
    try {
      console.log(`Starting LoRA training for model: ${params.modelName}`)
      
      // Step 1: Start Replicate training
      const replicateResponse = await this.replicate.startTraining({
        modelName: params.modelName,
        triggerWord: params.triggerWord,
        trainingImages: params.trainingImages,
        steps: params.steps,
        learningRate: params.learningRate,
        loraRank: params.loraRank,
      })

      if (replicateResponse.status === 'failed') {
        throw new Error(replicateResponse.error || 'Failed to start Replicate training')
      }

      const initialStatus: TrainingStatus = {
        id: replicateResponse.id,
        status: 'starting',
        progress: 0,
        stage: 'Initializing external training with Replicate',
        estimatedTimeRemaining: 1800, // 30 minutes
      }

      return {
        trainingId: replicateResponse.id,
        status: initialStatus
      }

    } catch (error) {
      console.error('Training service error:', error)
      
      const errorStatus: TrainingStatus = {
        id: `error_${Date.now()}`,
        status: 'failed',
        progress: 0,
        stage: 'Failed to start training',
        error: error instanceof Error ? error.message : 'Unknown error'
      }

      return {
        trainingId: errorStatus.id,
        status: errorStatus
      }
    }
  }

  /**
   * Check training status and handle workflow progression
   */
  async getTrainingStatus(trainingId: string, modelName: string): Promise<TrainingStatus> {
    try {
      // Check Replicate training status
      const replicateStatus = await this.replicate.getTrainingStatus(trainingId)
      
      switch (replicateStatus.status) {
        case 'starting':
          return {
            id: trainingId,
            status: 'starting',
            progress: 5,
            stage: 'Preparing training environment',
            estimatedTimeRemaining: 1800,
            logs: replicateStatus.logs
          }

        case 'processing':
          return {
            id: trainingId,
            status: 'training',
            progress: 30,
            stage: 'Training LoRA model (this may take 15-30 minutes)',
            estimatedTimeRemaining: 1200,
            logs: replicateStatus.logs
          }

        case 'succeeded':
          // Training completed, now upload to HuggingFace
          return await this.handleTrainingCompletion(trainingId, modelName, replicateStatus)

        case 'failed':
        case 'canceled':
          return {
            id: trainingId,
            status: 'failed',
            progress: 0,
            stage: 'Training failed',
            error: replicateStatus.error || 'Training was canceled or failed',
            logs: replicateStatus.logs
          }

        default:
          return {
            id: trainingId,
            status: 'training',
            progress: 10,
            stage: 'Training in progress',
            estimatedTimeRemaining: 1500,
          }
      }

    } catch (error) {
      console.error('Error checking training status:', error)
      return {
        id: trainingId,
        status: 'failed',
        progress: 0,
        stage: 'Status check failed',
        error: error instanceof Error ? error.message : 'Status check failed'
      }
    }
  }

  /**
   * Handle training completion and upload to HuggingFace
   */
  private async handleTrainingCompletion(
    trainingId: string, 
    modelName: string, 
    replicateStatus: any
  ): Promise<TrainingStatus> {
    try {
      console.log(`Training completed for ${modelName}, uploading to HuggingFace...`)

      // Upload to HuggingFace
      const uploadResponse = await this.huggingface.uploadModel({
        modelName: modelName.toLowerCase().replace(/\s+/g, '-'),
        modelPath: replicateStatus.output || '', // Replicate output path
        description: `Custom FLUX LoRA model: ${modelName}`,
        tags: ['flux', 'lora', 'text-to-image', 'custom'],
        isPrivate: false, // Make public for Together AI access
      })

      if (uploadResponse.status === 'failed') {
        return {
          id: trainingId,
          status: 'failed',
          progress: 95,
          stage: 'Failed to upload to HuggingFace',
          error: uploadResponse.error
        }
      }

      // Training and upload completed successfully
      return {
        id: trainingId,
        status: 'completed',
        progress: 100,
        stage: 'Training completed and model uploaded to HuggingFace',
        huggingFaceRepo: uploadResponse.repoId,
      }

    } catch (error) {
      console.error('Error handling training completion:', error)
      return {
        id: trainingId,
        status: 'failed',
        progress: 90,
        stage: 'Failed to complete workflow',
        error: error instanceof Error ? error.message : 'Completion failed'
      }
    }
  }

  /**
   * Cancel a training job
   */
  async cancelTraining(trainingId: string): Promise<boolean> {
    try {
      return await this.replicate.cancelTraining(trainingId)
    } catch (error) {
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