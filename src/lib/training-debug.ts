export enum TrainingStage {
  INITIALIZING = 'initializing',
  ZIP_CREATION = 'zip_creation',
  REPLICATE_UPLOAD = 'replicate_upload',
  REPLICATE_TRAINING = 'replicate_training',
  REPLICATE_COMPLETION = 'replicate_completion',
  HUGGINGFACE_DOWNLOAD = 'huggingface_download',
  HUGGINGFACE_UPLOAD = 'huggingface_upload',
  HUGGINGFACE_METADATA = 'huggingface_metadata',
  TOGETHER_UPLOAD = 'together_upload',
  TOGETHER_DEPLOY = 'together_deploy',
  COMPLETION = 'completion'
}

export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  RATE_LIMIT = 'rate_limit',
  SERVICE_ERROR = 'service_error',
  FILE_ERROR = 'file_error',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

export interface TrainingError {
  stage: TrainingStage
  category: ErrorCategory
  message: string
  originalError?: any
  timestamp: string
  trainingId: string
  retryable: boolean
  context?: Record<string, any>
}

export interface DebugLog {
  level: 'info' | 'warn' | 'error' | 'debug'
  stage: TrainingStage
  message: string
  timestamp: string
  trainingId: string
  data?: Record<string, any>
  duration?: number
}

export class TrainingDebugger {
  private logs: DebugLog[] = []
  private errors: TrainingError[] = []
  private stageTimings: Map<TrainingStage, { start: number; end?: number }> = new Map()

  constructor(private trainingId: string) {}

  /**
   * Start timing a stage
   */
  startStage(stage: TrainingStage, message: string, data?: Record<string, any>): void {
    const timestamp = new Date().toISOString()
    this.stageTimings.set(stage, { start: Date.now() })
    
    this.log('info', stage, `Starting: ${message}`, data)
  }

  /**
   * End timing a stage successfully
   */
  endStage(stage: TrainingStage, message: string, data?: Record<string, any>): void {
    const timing = this.stageTimings.get(stage)
    if (timing) {
      timing.end = Date.now()
      const duration = timing.end - timing.start
      this.log('info', stage, `Completed: ${message}`, { ...data, duration_ms: duration }, duration)
    }
  }

  /**
   * Log an error with automatic categorization
   */
  logError(
    stage: TrainingStage, 
    error: any, 
    message?: string,
    context?: Record<string, any>
  ): TrainingError {
    const category = this.categorizeError(error)
    const trainingError: TrainingError = {
      stage,
      category,
      message: message || this.extractErrorMessage(error),
      originalError: error,
      timestamp: new Date().toISOString(),
      trainingId: this.trainingId,
      retryable: this.isRetryable(category, error),
      context
    }

    this.errors.push(trainingError)
    this.log('error', stage, trainingError.message, {
      category,
      retryable: trainingError.retryable,
      ...context
    })

    return trainingError
  }

  /**
   * Log a debug message
   */
  log(
    level: DebugLog['level'], 
    stage: TrainingStage, 
    message: string, 
    data?: Record<string, any>,
    duration?: number
  ): void {
    const logEntry: DebugLog = {
      level,
      stage,
      message,
      timestamp: new Date().toISOString(),
      trainingId: this.trainingId,
      data,
      duration
    }

    this.logs.push(logEntry)
    
    // Console logging with structured format
    const logData = {
      trainingId: this.trainingId,
      stage,
      level,
      message,
      ...(data && { data }),
      ...(duration && { duration_ms: duration })
    }

    switch (level) {
      case 'error':
        console.error('🔴 TRAINING ERROR:', logData)
        break
      case 'warn':
        console.warn('🟡 TRAINING WARNING:', logData)
        break
      case 'info':
        console.log('🔵 TRAINING INFO:', logData)
        break
      case 'debug':
        console.debug('🟢 TRAINING DEBUG:', logData)
        break
    }
  }

  /**
   * Get current status summary for debugging
   */
  getDebugSummary(): {
    currentStage: TrainingStage | null
    totalErrors: number
    retryableErrors: number
    lastError: TrainingError | null
    stageTimings: Array<{ stage: TrainingStage; duration: number | null }>
    recentLogs: DebugLog[]
  } {
    const lastError = this.errors[this.errors.length - 1] || null
    const retryableErrors = this.errors.filter(e => e.retryable).length
    
    // Determine current stage from most recent log
    const currentStage = this.logs[this.logs.length - 1]?.stage || null

    // Calculate stage durations
    const stageTimings = Array.from(this.stageTimings.entries()).map(([stage, timing]) => ({
      stage,
      duration: timing.end ? timing.end - timing.start : null
    }))

    // Get last 10 logs
    const recentLogs = this.logs.slice(-10)

    return {
      currentStage,
      totalErrors: this.errors.length,
      retryableErrors,
      lastError,
      stageTimings,
      recentLogs
    }
  }

  /**
   * Export full debug information
   */
  exportDebugData(): {
    trainingId: string
    allLogs: DebugLog[]
    allErrors: TrainingError[]
    summary: ReturnType<TrainingDebugger['getDebugSummary']>
  } {
    return {
      trainingId: this.trainingId,
      allLogs: this.logs,
      allErrors: this.errors,
      summary: this.getDebugSummary()
    }
  }

  /**
   * Categorize errors for better debugging
   */
  private categorizeError(error: any): ErrorCategory {
    if (!error) return ErrorCategory.UNKNOWN

    const errorString = error.toString().toLowerCase()
    const errorMessage = error.message?.toLowerCase() || ''

    // Network errors
    if (errorString.includes('network') || 
        errorString.includes('fetch') || 
        errorString.includes('connection') ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND') {
      return ErrorCategory.NETWORK
    }

    // Authentication errors
    if (errorString.includes('unauthorized') || 
        errorString.includes('forbidden') ||
        errorString.includes('invalid token') ||
        error.status === 401 || 
        error.status === 403) {
      return ErrorCategory.AUTHENTICATION
    }

    // Rate limiting
    if (errorString.includes('rate limit') || 
        errorString.includes('too many requests') ||
        error.status === 429) {
      return ErrorCategory.RATE_LIMIT
    }

    // Validation errors
    if (errorString.includes('validation') || 
        errorString.includes('invalid') ||
        errorString.includes('bad request') ||
        error.status === 400) {
      return ErrorCategory.VALIDATION
    }

    // File errors
    if (errorString.includes('file') || 
        errorString.includes('upload') ||
        errorString.includes('download') ||
        errorString.includes('zip')) {
      return ErrorCategory.FILE_ERROR
    }

    // Timeout errors
    if (errorString.includes('timeout') || 
        errorString.includes('timedout') ||
        error.code === 'ETIMEDOUT') {
      return ErrorCategory.TIMEOUT
    }

    // Service-specific errors
    if (errorString.includes('replicate') || 
        errorString.includes('huggingface') ||
        errorString.includes('together')) {
      return ErrorCategory.SERVICE_ERROR
    }

    return ErrorCategory.UNKNOWN
  }

  /**
   * Extract meaningful error message
   */
  private extractErrorMessage(error: any): string {
    if (typeof error === 'string') return error
    if (error?.message) return error.message
    if (error?.error) return error.error
    if (error?.data?.message) return error.data.message
    return 'Unknown error occurred'
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(category: ErrorCategory, error: any): boolean {
    switch (category) {
      case ErrorCategory.NETWORK:
      case ErrorCategory.TIMEOUT:
      case ErrorCategory.RATE_LIMIT:
        return true
      
      case ErrorCategory.SERVICE_ERROR:
        // Some service errors are retryable
        return error?.status >= 500 || !error?.status
      
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.VALIDATION:
      case ErrorCategory.FILE_ERROR:
        return false
      
      default:
        return false
    }
  }
} 