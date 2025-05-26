import { TogetherAIService } from './together-ai'
import { HuggingFaceService } from './huggingface-service'
import { TrainingDebugger, TrainingStage, ErrorCategory } from './training-debug'

interface TogetherModelWorkflowParams {
  modelName: string
  huggingfaceRepo: string
  description?: string
  triggerWord?: string
  hfToken?: string
  autoDeployEndpoint?: boolean
}

interface TogetherModelWorkflowResponse {
  success: boolean
  togetherModelId?: string
  togetherEndpointId?: string
  status: 'uploading' | 'deploying' | 'ready' | 'failed'
  error?: string
  debugData?: any
}

interface TogetherModelStatus {
  modelId: string
  uploadStatus: 'processing' | 'completed' | 'failed'
  deploymentStatus?: 'deploying' | 'ready' | 'failed'
  endpointId?: string
  error?: string
  readyForInference: boolean
}

export class TogetherModelService {
  private together: TogetherAIService
  private huggingface: HuggingFaceService
  private trainingDebugger?: TrainingDebugger

  constructor(trainingDebugger?: TrainingDebugger) {
    this.together = new TogetherAIService()
    this.huggingface = new HuggingFaceService()
    this.trainingDebugger = trainingDebugger
  }

  /**
   * Complete workflow: Upload HuggingFace model to Together.ai and optionally deploy endpoint
   */
  async uploadAndDeployModel(params: TogetherModelWorkflowParams): Promise<TogetherModelWorkflowResponse> {
    const startTime = Date.now()
    
    try {
      this.trainingDebugger?.startStage(TrainingStage.TOGETHER_UPLOAD, 'Starting Together.ai model upload', {
        modelName: params.modelName,
        huggingfaceRepo: params.huggingfaceRepo
      })

      // Step 1: Upload model to Together.ai from HuggingFace
      const uploadResult = await this.together.uploadCustomModel({
        modelName: params.modelName,
        modelSource: params.huggingfaceRepo, // HuggingFace repo path
        description: params.description,
        hfToken: params.hfToken || process.env.HUGGINGFACE_TOKEN
      })

      if (uploadResult.status === 'failed') {
        throw new Error(uploadResult.error || 'Model upload failed')
      }

      this.trainingDebugger?.log('info', TrainingStage.TOGETHER_UPLOAD, 'Model upload initiated', {
        jobId: uploadResult.jobId,
        modelId: uploadResult.modelId
      })

      // Step 2: Wait for upload to complete
      const uploadStatus = await this.waitForJobCompletion(uploadResult.jobId, 'model_upload')
      
      if (uploadStatus.status !== 'Complete') {
        throw new Error(uploadStatus.error || 'Model upload failed')
      }

      this.trainingDebugger?.endStage(TrainingStage.TOGETHER_UPLOAD, 'Model upload completed', {
        modelId: uploadResult.modelId,
        duration: Date.now() - startTime
      })

      let endpointId: string | undefined
      let deploymentStatus: 'deploying' | 'ready' | 'failed' = 'ready'

      // Step 3: Deploy endpoint if requested
      if (params.autoDeployEndpoint) {
        this.trainingDebugger?.startStage(TrainingStage.TOGETHER_DEPLOY, 'Deploying Together.ai endpoint', {
          modelId: uploadResult.modelId
        })

        const deployResult = await this.together.deployModel({
          modelId: uploadResult.modelId,
          endpointName: `${params.modelName}-endpoint`
        })

        if (deployResult.status === 'failed') {
          this.trainingDebugger?.logError(
            TrainingStage.TOGETHER_DEPLOY,
            new Error(deployResult.error || 'Deployment failed'),
            'Endpoint deployment failed',
            { modelId: uploadResult.modelId }
          )
          // Don't fail the entire process if deployment fails
          deploymentStatus = 'failed'
        } else {
          endpointId = deployResult.endpointId
          deploymentStatus = deployResult.status
          
          this.trainingDebugger?.endStage(TrainingStage.TOGETHER_DEPLOY, 'Endpoint deployment initiated', {
            endpointId,
            modelId: uploadResult.modelId
          })
        }
      }

      return {
        success: true,
        togetherModelId: uploadResult.modelId,
        togetherEndpointId: endpointId,
        status: endpointId ? deploymentStatus : 'ready',
        debugData: this.trainingDebugger?.getDebugSummary()
      }

    } catch (error) {
      const trainingError = this.trainingDebugger?.logError(
        TrainingStage.TOGETHER_UPLOAD,
        error,
        'Together.ai model workflow failed',
        { 
          modelName: params.modelName,
          duration: Date.now() - startTime 
        }
      )

      return {
        success: false,
        status: 'failed',
        error: trainingError?.message || (error instanceof Error ? error.message : 'Workflow failed'),
        debugData: this.trainingDebugger?.getDebugSummary()
      }
    }
  }

  /**
   * Check the status of a Together.ai model (upload and deployment)
   */
  async getModelStatus(modelId: string, endpointId?: string): Promise<TogetherModelStatus> {
    try {
      // Check if this is a job ID or model ID
      let uploadStatus: 'processing' | 'completed' | 'failed' = 'completed'
      let deploymentStatus: 'deploying' | 'ready' | 'failed' | undefined
      let error: string | undefined

      // If modelId looks like a job ID, check job status
      if (modelId.startsWith('job-')) {
        const jobStatus = await this.together.getJobStatus(modelId)
        uploadStatus = jobStatus.status === 'Complete' ? 'completed' : 
                     jobStatus.status === 'Failed' ? 'failed' : 'processing'
        error = jobStatus.error
      }

      // Check endpoint status if provided
      if (endpointId) {
        // Note: Together.ai doesn't have a direct endpoint status API in their docs
        // This would need to be implemented based on their actual API
        deploymentStatus = 'ready' // Assume ready for now
      }

      return {
        modelId,
        uploadStatus,
        deploymentStatus,
        endpointId,
        error,
        readyForInference: uploadStatus === 'completed' && (!endpointId || deploymentStatus === 'ready')
      }

    } catch (error) {
      return {
        modelId,
        uploadStatus: 'failed',
        error: error instanceof Error ? error.message : 'Status check failed',
        readyForInference: false
      }
    }
  }

  /**
   * Wait for a Together.ai job to complete
   */
  private async waitForJobCompletion(
    jobId: string, 
    jobType: 'model_upload' | 'model_deploy',
    maxWaitTime: number = 1800000, // 30 minutes
    pollInterval: number = 30000 // 30 seconds
  ): Promise<{ status: string; error?: string }> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.together.getJobStatus(jobId)
        
        this.trainingDebugger?.log('debug', TrainingStage.TOGETHER_UPLOAD, `Job ${jobId} status: ${status.status}`, {
          jobId,
          status: status.status,
          type: jobType
        })

        if (status.status === 'Complete') {
          return { status: 'Complete' }
        }
        
        if (status.status === 'Failed') {
          return { 
            status: 'Failed', 
            error: status.error || 'Job failed without specific error' 
          }
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval))

      } catch (error) {
        this.trainingDebugger?.logError(
          TrainingStage.TOGETHER_UPLOAD,
          error,
          `Failed to check job status: ${jobId}`,
          { jobId, jobType }
        )
        
        // Continue polling unless we've exceeded max wait time
        if (Date.now() - startTime >= maxWaitTime) {
          return { 
            status: 'Failed', 
            error: 'Timeout waiting for job completion' 
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }

    return { 
      status: 'Failed', 
      error: 'Timeout waiting for job completion' 
    }
  }

  /**
   * Generate image using Together.ai custom model
   */
  async generateWithCustomModel(params: {
    prompt: string
    modelId: string
    triggerWord?: string
    width?: number
    height?: number
    steps?: number
    aspectRatio?: '1:1' | '16:9' | '9:16' | '3:4' | '4:3'
    seed?: number
  }) {
    return this.together.generateWithLoRA({
      ...params,
      loraPath: params.modelId,
      useTogetherModel: true // Use Together.ai model format
    })
  }
} 