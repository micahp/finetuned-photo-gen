export interface UnifiedTrainingStatus {
  // Core status info
  id: string
  status: 'starting' | 'training' | 'uploading' | 'completed' | 'failed'
  progress: number
  stage: string
  
  // Additional info
  estimatedTimeRemaining?: number
  huggingFaceRepo?: string
  error?: string
  logs?: string
  debugData?: any
  
  // Source tracking for debugging
  sources: {
    jobQueue: string
    replicate: string
    userModel: string
    huggingFace: boolean
  }
  
  // Actions needed
  needsUpload: boolean
  canRetryUpload: boolean
}

export interface StatusSources {
  jobQueue: {
    status: string
    errorMessage?: string | null
    completedAt?: Date | null
  }
  replicate: {
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
    error?: string
    logs?: string
  }
  userModel: {
    status: string
    huggingfaceRepo?: string | null
    loraReadyForInference: boolean
    trainingCompletedAt?: Date | null
  }
}

export interface LogProgress {
  stage: 'uploading_images' | 'loading_model' | 'training' | 'completed' | 'unknown'
  progress: number
  currentStep?: number
  totalSteps?: number
  stageDescription: string
}

export class TrainingStatusResolver {
  /**
   * Parse training logs to extract progress and stage information
   */
  static parseTrainingLogs(logs?: string): LogProgress {
    if (!logs) {
      return {
        stage: 'unknown',
        progress: 0,
        stageDescription: 'No logs available'
      }
    }

    const logLines = logs.split('\n').filter(line => line.trim())
    const lastLines = logLines.slice(-20) // Look at last 20 lines for current status
    
    // Check for completion first
    if (logs.includes('flux_train_replicate: 100%') || logs.includes('Saved to output/')) {
      return {
        stage: 'completed',
        progress: 100,
        stageDescription: 'Training completed successfully'
      }
    }
    
    // Look for training progress
    const trainingProgressRegex = /flux_train_replicate:\s*(\d+)%.*?\|\s*(\d+)\/(\d+)/
    for (let i = lastLines.length - 1; i >= 0; i--) {
      const line = lastLines[i]
      const match = line.match(trainingProgressRegex)
      if (match) {
        const progressPercent = parseInt(match[1])
        const currentStep = parseInt(match[2])
        const totalSteps = parseInt(match[3])
        
        return {
          stage: 'training',
          progress: Math.min(progressPercent, 99), // Cap at 99% until truly complete
          currentStep,
          totalSteps,
          stageDescription: `Training LoRA model (${currentStep}/${totalSteps} steps)`
        }
      }
    }
    
    // Check for model loading stage
    if (logs.includes('Loading Flux model') || logs.includes('Loading transformer') || 
        logs.includes('Loading checkpoint shards') || logs.includes('create LoRA network')) {
      // If we see training setup but no progress yet
      if (logs.includes('flux_train_replicate:   0%')) {
        return {
          stage: 'training',
          progress: 1,
          stageDescription: 'Initializing training...'
        }
      }
      return {
        stage: 'loading_model',
        progress: 15,
        stageDescription: 'Loading FLUX model and preparing training environment'
      }
    }
    
    // Check for image upload/preparation stage
    if (logs.includes('Extracted') && logs.includes('files from zip') || 
        logs.includes('Caching latents') || logs.includes('Preprocessing image dimensions')) {
      return {
        stage: 'uploading_images',
        progress: 5,
        stageDescription: 'Uploading and processing training images'
      }
    }
    
    // Default for early stages
    return {
      stage: 'uploading_images',
      progress: 2,
      stageDescription: 'Preparing training environment'
    }
  }

  /**
   * Resolve the unified training status from all sources of truth
   */
  static resolveStatus(
    trainingId: string,
    modelName: string,
    sources: StatusSources
  ): UnifiedTrainingStatus {
    const { jobQueue, replicate, userModel } = sources
    
    // Parse logs for detailed progress if available
    const logProgress = this.parseTrainingLogs(replicate.logs)
    
    // Determine the true status based on priority:
    // 1. If HuggingFace repo exists and model is ready -> completed
    // 2. If Replicate succeeded but no HF repo -> uploading/ready for upload
    // 3. If Replicate failed -> failed
    // 4. If Replicate in progress -> use log-based progress
    // 5. Fallback to job queue status
    
    const hasHuggingFaceRepo = !!userModel.huggingfaceRepo
    const isModelReady = userModel.status === 'ready' && userModel.loraReadyForInference
    
    let resolvedStatus: UnifiedTrainingStatus['status']
    let stage: string
    let progress: number
    let error: string | undefined
    let needsUpload = false
    let canRetryUpload = false
    
    // Case 1: Model is fully completed with HuggingFace repo
    if (hasHuggingFaceRepo && isModelReady) {
      resolvedStatus = 'completed'
      stage = 'Training completed successfully and model uploaded to HuggingFace'
      progress = 100
    }
    // Case 2: Replicate succeeded but no HuggingFace upload yet
    else if (replicate.status === 'succeeded' && !hasHuggingFaceRepo) {
      resolvedStatus = 'uploading'
      stage = 'Training completed successfully, ready for upload to HuggingFace'
      progress = 90
      needsUpload = true
      canRetryUpload = true
    }
    // Case 3: Replicate succeeded and upload in progress (model exists but not ready)
    else if (replicate.status === 'succeeded' && hasHuggingFaceRepo && !isModelReady) {
      resolvedStatus = 'uploading'
      stage = 'Training completed, uploading to HuggingFace...'
      progress = 95
    }
    // Case 4: Replicate failed
    else if (replicate.status === 'failed') {
      resolvedStatus = 'failed'
      stage = this.getFailureStage(replicate.error, jobQueue.errorMessage)
      progress = 0
      error = replicate.error || jobQueue.errorMessage || 'Training failed'
    }
    // Case 5: Replicate in progress - use log-based progress
    else if (replicate.status === 'processing') {
      resolvedStatus = 'training'
      
      // Use log-based progress and stage
      if (logProgress.stage === 'uploading_images') {
        stage = logProgress.stageDescription
        progress = logProgress.progress
      } else if (logProgress.stage === 'loading_model') {
        stage = logProgress.stageDescription
        progress = logProgress.progress
      } else if (logProgress.stage === 'training') {
        stage = logProgress.stageDescription
        progress = Math.max(20, logProgress.progress) // Training is at least 20% when it starts
      } else if (logProgress.stage === 'completed') {
        stage = 'Training completed, preparing for upload'
        progress = 85
      } else {
        stage = 'Training LoRA model (this may take 15-30 minutes)'
        progress = 40
      }
    }
    // Case 6: Replicate starting
    else if (replicate.status === 'starting') {
      resolvedStatus = 'starting'
      stage = 'Preparing training environment'
      progress = 10
    }
    // Case 7: Fallback to job queue status with interpretation
    else {
      const interpretation = this.interpretJobQueueStatus(jobQueue, userModel)
      resolvedStatus = interpretation.status
      stage = interpretation.stage
      progress = interpretation.progress
      error = interpretation.error
      needsUpload = interpretation.needsUpload
      canRetryUpload = interpretation.canRetryUpload
    }
    
    return {
      id: trainingId,
      status: resolvedStatus,
      progress,
      stage,
      estimatedTimeRemaining: this.calculateTimeRemaining(resolvedStatus, progress, logProgress),
      huggingFaceRepo: userModel.huggingfaceRepo || undefined,
      error,
      logs: replicate.logs,
      sources: {
        jobQueue: jobQueue.status,
        replicate: replicate.status,
        userModel: userModel.status,
        huggingFace: hasHuggingFaceRepo
      },
      needsUpload,
      canRetryUpload,
      debugData: {
        logProgress
      }
    }
  }
  
  /**
   * Determine failure stage based on error messages
   */
  private static getFailureStage(replicateError?: string, jobError?: string | null): string {
    const error = replicateError || jobError || ''
    
    if (error.toLowerCase().includes('zip') || error.toLowerCase().includes('image')) {
      return 'Failed during image preparation'
    }
    if (error.toLowerCase().includes('initializing') || error.toLowerCase().includes('setup')) {
      return 'Failed during initialization'
    }
    if (error.toLowerCase().includes('training') || error.toLowerCase().includes('lora')) {
      return 'Failed during LoRA training'
    }
    if (error.toLowerCase().includes('upload') || error.toLowerCase().includes('huggingface')) {
      return 'Failed during HuggingFace upload'
    }
    
    return 'Training failed'
  }
  
  /**
   * Interpret job queue status when external status is unclear
   */
  private static interpretJobQueueStatus(
    jobQueue: StatusSources['jobQueue'],
    userModel: StatusSources['userModel']
  ) {
    const hasHuggingFaceRepo = !!userModel.huggingfaceRepo
    const isModelReady = userModel.status === 'ready'
    
    // If model is ready with HF repo, override job queue status
    if (isModelReady && hasHuggingFaceRepo) {
      return {
        status: 'completed' as const,
        stage: 'Training completed successfully and model uploaded to HuggingFace',
        progress: 100,
        error: undefined,
        needsUpload: false,
        canRetryUpload: false
      }
    }
    
    // If job queue shows succeeded but no HF repo
    if (jobQueue.status === 'succeeded' && !hasHuggingFaceRepo) {
      return {
        status: 'uploading' as const,
        stage: 'Training completed successfully, ready for upload to HuggingFace',
        progress: 90,
        error: undefined,
        needsUpload: true,
        canRetryUpload: true
      }
    }
    
    // Map job queue status to display status
    switch (jobQueue.status) {
      case 'running':
      case 'pending':
        return {
          status: 'training' as const,
          stage: 'Training in progress',
          progress: 30,
          error: undefined,
          needsUpload: false,
          canRetryUpload: false
        }
      case 'completed':
        return {
          status: 'completed' as const,
          stage: 'Training completed successfully',
          progress: 100,
          error: undefined,
          needsUpload: false,
          canRetryUpload: false
        }
      case 'failed':
        return {
          status: 'failed' as const,
          stage: this.getFailureStage(undefined, jobQueue.errorMessage),
          progress: 0,
          error: jobQueue.errorMessage || 'Training failed',
          needsUpload: false,
          canRetryUpload: false
        }
      default:
        return {
          status: 'starting' as const,
          stage: 'Initializing training',
          progress: 5,
          error: undefined,
          needsUpload: false,
          canRetryUpload: false
        }
    }
  }
  
  /**
   * Calculate estimated time remaining based on status and progress
   */
  private static calculateTimeRemaining(status: string, progress: number, logProgress: LogProgress): number | undefined {
    switch (status) {
      case 'starting':
        return 1800 // 30 minutes
      case 'training':
        // Use log progress for more accurate estimates
        if (logProgress.stage === 'uploading_images') {
          return 1500 // ~25 minutes remaining (images + model loading + training)
        } else if (logProgress.stage === 'loading_model') {
          return 1200 // ~20 minutes remaining (model loading + training)
        } else if (logProgress.stage === 'training' && logProgress.currentStep && logProgress.totalSteps) {
          // Calculate based on actual training progress
          const remainingSteps = logProgress.totalSteps - logProgress.currentStep
          const estimatedSecondsPerStep = 0.6 // Rough estimate from logs
          return Math.max(60, remainingSteps * estimatedSecondsPerStep)
        } else {
          // Fallback estimate based on progress percentage
          const remainingProgress = 100 - progress
          return Math.max(300, (remainingProgress / 60) * 1800) // 5 min to 30 min
        }
      case 'uploading':
        return 300 // 5 minutes
      default:
        return undefined
    }
  }
  
  /**
   * Get pipeline stage status for the training details page
   */
  static getPipelineStageStatus(
    stage: string,
    unifiedStatus: UnifiedTrainingStatus
  ): {
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    error?: string
    startTime?: string
    endTime?: string
    duration?: number
  } {
    const stageOrder = ['initializing', 'zip_creation', 'replicate_training', 'huggingface_upload', 'completion']
    const currentStageIndex = stageOrder.indexOf(stage)
    
    // If training failed, determine which stage failed
    if (unifiedStatus.status === 'failed') {
      const failureStage = this.determineFailureStage(unifiedStatus.error || '')
      const failureIndex = stageOrder.indexOf(failureStage)
      
      if (currentStageIndex < failureIndex) {
        return { status: 'completed' }
      } else if (currentStageIndex === failureIndex) {
        return { status: 'failed', error: unifiedStatus.error }
      } else {
        return { status: 'pending' }
      }
    }
    
    // For successful/in-progress training
    switch (unifiedStatus.status) {
      case 'starting':
        if (stage === 'initializing' || stage === 'zip_creation') {
          return { status: 'in_progress' }
        }
        return { status: 'pending' }
        
      case 'training':
        if (currentStageIndex <= 1) {
          return { status: 'completed' }
        } else if (stage === 'replicate_training') {
          return { status: 'in_progress' }
        }
        return { status: 'pending' }
        
      case 'uploading':
        if (currentStageIndex <= 2) {
          return { status: 'completed' }
        } else if (stage === 'huggingface_upload') {
          return unifiedStatus.needsUpload 
            ? { status: 'pending' } 
            : { status: 'in_progress' }
        }
        return { status: 'pending' }
        
      case 'completed':
        if (stage === 'completion') {
          return { status: 'completed' }
        } else if (currentStageIndex < stageOrder.length - 1) {
          return { status: 'completed' }
        }
        return { status: 'completed' }
        
      default:
        return { status: 'pending' }
    }
  }
  
  /**
   * Determine which stage failed based on error message
   */
  private static determineFailureStage(error: string): string {
    const lowerError = error.toLowerCase()
    
    if (lowerError.includes('zip') || lowerError.includes('image')) {
      return 'zip_creation'
    }
    if (lowerError.includes('initializing') || lowerError.includes('setup')) {
      return 'initializing'
    }
    if (lowerError.includes('upload') || lowerError.includes('huggingface')) {
      return 'huggingface_upload'
    }
    
    // Default to training stage for most failures
    return 'replicate_training'
  }
} 