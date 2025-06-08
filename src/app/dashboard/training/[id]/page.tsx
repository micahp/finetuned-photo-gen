'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft,
  Play, 
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  Activity,
  FileText,
  Settings,
  Download,
  ExternalLink,
  Copy,
  Archive,
  Database,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TrainingStatusResolver } from '@/lib/training-status-resolver'

interface TrainingJob {
  id: string
  modelId: string
  modelName: string
  status: 'starting' | 'training' | 'uploading' | 'completed' | 'failed'
  stage: string
  progress: number
  creditsUsed: number
  estimatedCost: number
  estimatedTimeRemaining?: number
  huggingFaceRepo?: string
  error?: string
  logs?: string
  debugData?: any
  createdAt: string
  completedAt?: string
  trainingImages: number
  trainingParams: {
    steps: number
    learningRate: number
    loraRank: number
    baseModel: string
  }
  validationStatus?: string | null
  validationError?: string | null
  lastValidationCheck?: string | null
}

interface DebugStage {
  stage: string
  status: 'completed' | 'in_progress' | 'failed' | 'pending'
  duration?: number
  error?: string
  data?: Record<string, any>
  startTime?: string
  endTime?: string
}

const statusConfig = {
  starting: { label: 'Starting', icon: Play, color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  training: { label: 'Training', icon: Activity, color: 'bg-yellow-500', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700' },
  uploading: { label: 'Uploading', icon: Activity, color: 'bg-purple-500', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700' },
  failed: { label: 'Failed', icon: XCircle, color: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700' },
}

const stageConfig = {
  initializing: { label: 'Initialization', icon: Settings, description: 'Setting up training environment' },
  zip_creation: { label: 'Image Preparation', icon: Archive, description: 'Creating training images bundle' },
  replicate_training: { label: 'LoRA Training', icon: Zap, description: 'Training the LoRA model with Replicate' },
  completion: { label: 'Completion', icon: CheckCircle, description: 'Training workflow completed successfully' },
}

export default function TrainingDetailsPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const trainingId = params.id as string
  
  const [trainingJob, setTrainingJob] = useState<TrainingJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [backgroundUpdating, setBackgroundUpdating] = useState(false)

  // Fetch training job details from API
  const fetchTrainingJob = useCallback(async (isBackgroundUpdate = false) => {
    try {
      // Only show loading spinner on initial load, not background updates
      if (!isBackgroundUpdate) {
        setLoading(true)
      } else {
        setBackgroundUpdating(true)
      }
      
      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
      
      const response = await fetch(`/api/training/jobs/${trainingId}`, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        } else if (response.status === 404) {
          throw new Error('Training job not found.')
        } else {
          throw new Error(`Server error: ${response.status}`)
        }
      }
      
      const data = await response.json()
      
      if (data.success) {
        setTrainingJob(data.job)
      } else {
        console.error('Failed to fetch training job:', data.error)
        // Don't clear existing data on background update failures
        if (!isBackgroundUpdate) {
          setTrainingJob(null)
        }
      }
    } catch (error) {
      console.error('Failed to fetch training job:', error)
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('Request timed out')
        }
      }
      
      // Don't clear existing data on background update failures
      if (!isBackgroundUpdate) {
        setTrainingJob(null)
      }
    } finally {
      // Only hide loading spinner if this was initial load
      if (!isBackgroundUpdate) {
        setLoading(false)
      } else {
        setBackgroundUpdating(false)
      }
    }
  }, [trainingId])

  useEffect(() => {
    if (session?.user) {
      fetchTrainingJob()
    }
  }, [session, fetchTrainingJob])

  // Auto-refresh for active training jobs
  useEffect(() => {
    if (!autoRefresh || !trainingJob || !['starting', 'training', 'uploading'].includes(trainingJob.status)) {
      return
    }

    const interval = setInterval(() => {
      fetchTrainingJob(true) // Background update - no loading spinner
    }, 10000) // Refresh every 10 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, trainingJob?.status, fetchTrainingJob])

  const refreshJob = async () => {
    setRefreshing(true)
    await fetchTrainingJob(true) // Background update - no loading spinner
    setRefreshing(false)
  }

  const retryUpload = async () => {
    if (!trainingJob?.modelId) return
    console.log('Retrying upload for modelId:', trainingJob.modelId)
    setRetrying(true)
    try {
      const response = await fetch('/api/models/retry-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: trainingJob.modelId
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Refresh the training job data to show updated status
        await fetchTrainingJob()
        // Optional: Show success message
        console.log('Upload retry successful:', data.message)
      } else {
        console.error('Upload retry failed:', data.error)
        // Optional: Show error message to user
      }
    } catch (error) {
      console.error('Upload retry error:', error)
    } finally {
      setRetrying(false)
    }
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m`
  }

  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    if (hours > 0) {
      return `~${hours}h ${minutes % 60}m remaining`
    }
    return `~${minutes}m remaining`
  }

  const getStatusIcon = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig]
    if (!config) return statusConfig.failed
    return config
  }

  const getStageStatus = (stage: string, debugData: any): DebugStage => {
    // If we have unified status data from the new resolver, use it
    if (debugData?.sources && trainingJob) {
      const unifiedStatus = {
        id: trainingJob.id,
        status: trainingJob.status,
        progress: trainingJob.progress,
        stage: trainingJob.stage,
        error: trainingJob.error,
        needsUpload: debugData.needsUpload || false,
        canRetryUpload: debugData.canRetryUpload || false,
        sources: debugData.sources
      }
      
      const pipelineStatus = TrainingStatusResolver.getPipelineStageStatus(stage, unifiedStatus)
      return {
        stage,
        status: pipelineStatus.status,
        error: pipelineStatus.error,
        startTime: pipelineStatus.startTime,
        endTime: pipelineStatus.endTime,
        duration: pipelineStatus.duration
      }
    }
    
    // Fallback to original logic if no unified status data
    if (!debugData) {
      // If no debug data, infer from main training status
      return inferStageFromTrainingStatus(stage, trainingJob?.status, trainingJob?.stage)
    }
    
    // Check stageTimings array from debug data
    const stageTimings = debugData?.stageTimings || []
    const stageTiming = stageTimings.find((s: any) => s.stage === stage)
    
    if (stageTiming) {
      return {
        stage,
        status: stageTiming.duration !== null ? 'completed' : 'in_progress',
        duration: stageTiming.duration,
        startTime: stageTiming.startTime,
        endTime: stageTiming.endTime
      }
    }

    // Check if this is the current stage
    if (debugData?.currentStage === stage) {
      return {
        stage,
        status: 'in_progress'
      }
    }

    // Check if there's an error for this stage
    const lastError = debugData?.lastError
    if (lastError?.stage === stage) {
      return {
        stage,
        status: 'failed',
        error: lastError.message
      }
    }

    // Check recent logs to see if stage was mentioned
    const recentLogs = debugData?.recentLogs || []
    const stageLog = recentLogs.find((log: any) => log.stage === stage)
    
    if (stageLog) {
      if (stageLog.level === 'error') {
        return {
          stage,
          status: 'failed',
          error: stageLog.message,
          startTime: stageLog.timestamp
        }
      } else if (stageLog.message?.includes('Starting:')) {
        return {
          stage,
          status: 'in_progress',
          startTime: stageLog.timestamp
        }
      } else if (stageLog.message?.includes('Completed:')) {
        return {
          stage,
          status: 'completed',
          endTime: stageLog.timestamp,
          duration: stageLog.duration
        }
      }
    }

    // Fallback to inference from training status
    return inferStageFromTrainingStatus(stage, trainingJob?.status, trainingJob?.stage)
  }

  const inferStageFromTrainingStatus = (stage: string, trainingStatus?: string, trainingStage?: string): DebugStage => {
    if (!trainingStatus) {
      return { stage, status: 'pending' }
    }

    const stageOrder = ['initializing', 'zip_creation', 'replicate_training', 'huggingface_upload', 'completion']
    const currentStageIndex = stageOrder.indexOf(stage)
    
    switch (trainingStatus) {
      case 'starting':
        if (stage === 'initializing') {
          return { stage, status: 'in_progress' }
        } else if (stage === 'zip_creation') {
          return { stage, status: 'in_progress' }
        }
        return { stage, status: 'pending' }
        
      case 'training':
        if (currentStageIndex <= 1) {
          return { stage, status: 'completed' }
        } else if (stage === 'replicate_training') {
          return { stage, status: 'in_progress' }
        }
        return { stage, status: 'pending' }
        
      case 'uploading':
        if (currentStageIndex <= 2) {
          return { stage, status: 'completed' }
        } else if (stage === 'huggingface_upload') {
          // Check if ready for upload vs actively uploading
          if (trainingStage?.includes('ready for upload')) {
            return { stage, status: 'pending' }
          }
          return { stage, status: 'in_progress' }
        }
        return { stage, status: 'pending' }
        
      case 'completed':
        if (stage === 'completion') {
          return { stage, status: 'completed' }
        } else if (currentStageIndex < stageOrder.length - 1) {
          return { stage, status: 'completed' }
        }
        return { stage, status: 'completed' }
        
      case 'failed':
        // Determine which stage failed based on the training stage description
        if (trainingStage?.toLowerCase().includes('initializing') || trainingStage?.toLowerCase().includes('preparing')) {
          if (stage === 'initializing') return { stage, status: 'failed' }
          return { stage, status: 'pending' }
        } else if (trainingStage?.toLowerCase().includes('zip') || trainingStage?.toLowerCase().includes('image')) {
          if (currentStageIndex <= 0) return { stage, status: 'completed' }
          if (stage === 'zip_creation') return { stage, status: 'failed' }
          return { stage, status: 'pending' }
        } else if (trainingStage?.toLowerCase().includes('training') || trainingStage?.toLowerCase().includes('lora')) {
          if (currentStageIndex <= 1) return { stage, status: 'completed' }
          if (stage === 'replicate_training') return { stage, status: 'failed' }
          return { stage, status: 'pending' }
        } else if (trainingStage?.toLowerCase().includes('upload') || trainingStage?.toLowerCase().includes('huggingface')) {
          if (currentStageIndex <= 2) return { stage, status: 'completed' }
          if (stage === 'huggingface_upload') return { stage, status: 'failed' }
          return { stage, status: 'pending' }
        }
        return { stage, status: 'failed' }
        
      default:
        return { stage, status: 'pending' }
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900">Loading training details...</p>
            <p className="text-sm text-gray-600">Training ID: {trainingId}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!trainingJob) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Training job not found</h3>
            <p className="text-gray-600 mb-4">The training job you're looking for doesn't exist or you don't have access to it.</p>
            <Link href="/dashboard/training">
              <Button>Back to Training</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusIcon = getStatusIcon(trainingJob.status)
  const StatusIcon = statusIcon.icon

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard/training">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Training
              </Button>
            </Link>
            
            <div className="flex items-center space-x-3">
              <div className={cn("p-2 rounded-full", statusIcon.bgColor)}>
                <StatusIcon className={cn("h-6 w-6", statusIcon.textColor)} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{trainingJob.modelName}</h1>
                <p className="text-gray-600">{trainingJob.stage}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {backgroundUpdating && (
              <div className="flex items-center text-sm text-gray-500">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                <span>Updating...</span>
              </div>
            )}
            <Button 
              onClick={refreshJob} 
              disabled={refreshing} 
              variant="outline"
              size="sm"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Progress</p>
                <p className="text-2xl font-bold text-gray-900">{trainingJob.progress}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Cost</p>
                <p className="text-2xl font-bold text-gray-900">${trainingJob.estimatedCost.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Database className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Images</p>
                <p className="text-2xl font-bold text-gray-900">{trainingJob.trainingImages}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  {trainingJob.estimatedTimeRemaining ? 'Time Remaining' : 'Duration'}
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {trainingJob.estimatedTimeRemaining 
                    ? formatTimeRemaining(trainingJob.estimatedTimeRemaining).replace('~', '').replace(' remaining', '')
                    : trainingJob.completedAt 
                    ? formatDuration(new Date(trainingJob.completedAt).getTime() - new Date(trainingJob.createdAt).getTime())
                    : formatDuration(Date.now() - new Date(trainingJob.createdAt).getTime())
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Temporary Debug Section - Remove after fixing */}
      <Card className="mb-8 border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">Debug Info:</h3>
          <div className="text-xs text-yellow-700 space-y-1">
            <div>Status: <code>{trainingJob.status}</code></div>
            <div>Stage: <code>{trainingJob.stage}</code></div>
            <div>Has Error: <code>{!!trainingJob.error}</code></div>
            <div>Error: <code>{trainingJob.error || 'None'}</code></div>
            <div>Model ID: <code>{trainingJob.modelId}</code></div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Bar */}
      {['starting', 'training', 'uploading'].includes(trainingJob.status) && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Training Progress</h3>
              <Badge variant="outline" className={cn("", statusIcon.textColor)}>
                {statusIcon.label}
              </Badge>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-500" 
                style={{ width: `${trainingJob.progress}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>
                {/* Use parsed log progress for better stage descriptions */}
                {trainingJob.debugData?.logProgress?.stageDescription || trainingJob.stage}
                {trainingJob.debugData?.logProgress?.currentStep && trainingJob.debugData?.logProgress?.totalSteps && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({trainingJob.debugData.logProgress.currentStep}/{trainingJob.debugData.logProgress.totalSteps} steps)
                  </span>
                )}
              </span>
              <span>{trainingJob.progress}%</span>
            </div>
            {trainingJob.estimatedTimeRemaining && (
              <p className="text-sm text-gray-500 mt-2">{formatTimeRemaining(trainingJob.estimatedTimeRemaining)}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stages">Pipeline Stages</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="debug">Debug Data</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Training Information */}
            <Card>
              <CardHeader>
                <CardTitle>Training Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Training ID</span>
                  <div className="flex items-center space-x-2">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">{trainingJob.id}</code>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => copyToClipboard(trainingJob.id)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Model ID</span>
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">{trainingJob.modelId}</code>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Created</span>
                  <span className="text-sm text-gray-900">
                    {new Date(trainingJob.createdAt).toLocaleString()}
                  </span>
                </div>
                
                {trainingJob.completedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Completed</span>
                    <span className="text-sm text-gray-900">
                      {new Date(trainingJob.completedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Credits Used</span>
                  <span className="text-sm text-gray-900">{trainingJob.creditsUsed}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Estimated Cost</span>
                  <span className="text-sm text-gray-900">${trainingJob.estimatedCost.toFixed(2)}</span>
                </div>


              </CardContent>
            </Card>

            {/* Error Information (if failed) */}
            {trainingJob.error && (
              <Card className="border-red-200 bg-gradient-to-br from-red-50 to-red-100/50">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-red-800 text-lg font-semibold">
                        Training Failed
                      </CardTitle>
                      <p className="text-sm text-red-600 mt-1">
                        We encountered an issue during the training process.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Main Error Message */}
                  <div className="bg-white/60 border border-red-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-red-800 mb-2 flex items-center space-x-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      <span>Error Details</span>
                    </h4>
                    <p className="text-sm text-red-700 leading-relaxed break-words overflow-hidden">{trainingJob.error}</p>
                  </div>

                  {/* Debug Information */}
                  {trainingJob.debugData?.lastError && (
                    <div className="bg-white/40 border border-red-100 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-red-700 mb-3 flex items-center space-x-2">
                        <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                        <span>Technical Information</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-red-600 font-medium">Stage:</span>
                            <span className="text-red-800 capitalize">{trainingJob.debugData.lastError.stage.replace('_', ' ')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-red-600 font-medium">Category:</span>
                            <span className="text-red-800 capitalize">{trainingJob.debugData.lastError.category}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-red-600 font-medium">Time:</span>
                            <span className="text-red-800">{new Date(trainingJob.debugData.lastError.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-red-600 font-medium">Retryable:</span>
                            <span className={`font-medium ${trainingJob.debugData.lastError.retryable ? 'text-green-700' : 'text-red-800'}`}>
                              {trainingJob.debugData.lastError.retryable ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  

                </CardContent>
              </Card>
            )}



            {/* Model Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Model Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Base Model</span>
                  <span className="text-sm text-gray-900">{trainingJob.trainingParams.baseModel}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Training Steps</span>
                  <span className="text-sm text-gray-900">{trainingJob.trainingParams.steps}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Learning Rate</span>
                  <span className="text-sm text-gray-900">{trainingJob.trainingParams.learningRate}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">LoRA Rank</span>
                  <span className="text-sm text-gray-900">{trainingJob.trainingParams.loraRank}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Training Images</span>
                  <span className="text-sm text-gray-900">{trainingJob.trainingImages} images</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Pipeline Stages Tab */}
        <TabsContent value="stages" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Training Pipeline Stages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(stageConfig).map(([stage, config], index) => {
                  const stageStatus = getStageStatus(stage, trainingJob.debugData)
                  const StageIcon = config.icon
                  
                  return (
                    <div key={stage} className="flex items-start space-x-4">
                      {/* Stage Icon and Status */}
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "p-3 rounded-full border-2",
                          stageStatus.status === 'completed' && "bg-green-50 border-green-200",
                          stageStatus.status === 'in_progress' && "bg-blue-50 border-blue-200",
                          stageStatus.status === 'failed' && "bg-red-50 border-red-200",
                          stageStatus.status === 'pending' && "bg-gray-50 border-gray-200"
                        )}>
                          <StageIcon className={cn(
                            "h-5 w-5",
                            stageStatus.status === 'completed' && "text-green-600",
                            stageStatus.status === 'in_progress' && "text-blue-600",
                            stageStatus.status === 'failed' && "text-red-600",
                            stageStatus.status === 'pending' && "text-gray-400"
                          )} />
                        </div>
                        
                        {/* Connector Line */}
                        {index < Object.keys(stageConfig).length - 1 && (
                          <div className={cn(
                            "w-0.5 h-8 mt-2",
                            stageStatus.status === 'completed' ? "bg-green-200" : "bg-gray-200"
                          )} />
                        )}
                      </div>

                      {/* Stage Content */}
                      <div className="flex-1 pb-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-medium text-gray-900">{config.label}</h3>
                          <Badge variant="outline" className={cn(
                            stageStatus.status === 'completed' && "border-green-200 text-green-700",
                            stageStatus.status === 'in_progress' && "border-blue-200 text-blue-700",
                            stageStatus.status === 'failed' && "border-red-200 text-red-700",
                            stageStatus.status === 'pending' && "border-gray-200 text-gray-500"
                          )}>
                            {stageStatus.status === 'completed' && 'Completed'}
                            {stageStatus.status === 'in_progress' && 'In Progress'}
                            {stageStatus.status === 'failed' && 'Failed'}
                            {stageStatus.status === 'pending' && 'Pending'}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">{config.description}</p>
                        
                        {/* Stage Details */}
                        <div className="text-xs text-gray-500 space-y-1">
                          {stageStatus.startTime && (
                            <p><strong>Started:</strong> {new Date(stageStatus.startTime).toLocaleString()}</p>
                          )}
                          {stageStatus.endTime && (
                            <p><strong>Completed:</strong> {new Date(stageStatus.endTime).toLocaleString()}</p>
                          )}
                          {stageStatus.duration && (
                            <p><strong>Duration:</strong> {formatDuration(stageStatus.duration)}</p>
                          )}
                          {stageStatus.error && (
                            <p className="text-red-600"><strong>Error:</strong> {stageStatus.error}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Training Logs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Training Progress Summary */}
              {trainingJob.logs && trainingJob.debugData?.logProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-3">Current Training Progress</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-blue-600 uppercase tracking-wide">Stage</p>
                      <p className="text-sm font-medium text-blue-900">
                        {trainingJob.debugData.logProgress.stage === 'uploading_images' && 'Uploading Images'}
                        {trainingJob.debugData.logProgress.stage === 'loading_model' && 'Loading Model'}
                        {trainingJob.debugData.logProgress.stage === 'training' && 'Training'}
                        {trainingJob.debugData.logProgress.stage === 'completed' && 'Completed'}
                        {trainingJob.debugData.logProgress.stage === 'unknown' && 'Initializing'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 uppercase tracking-wide">Progress</p>
                      <p className="text-sm font-medium text-blue-900">
                        {trainingJob.debugData.logProgress.progress}%
                        {trainingJob.debugData.logProgress.currentStep && trainingJob.debugData.logProgress.totalSteps && (
                          <span className="text-xs text-blue-700 ml-1">
                            ({trainingJob.debugData.logProgress.currentStep}/{trainingJob.debugData.logProgress.totalSteps} steps)
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 uppercase tracking-wide">Status</p>
                      <p className="text-sm font-medium text-blue-900">
                        {trainingJob.debugData.logProgress.stageDescription}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Raw Logs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Raw Training Logs</h4>
                  {trainingJob.logs && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(trainingJob.logs || '')}
                      className="text-xs"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Logs
                    </Button>
                  )}
                </div>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap">{trainingJob.logs || 'No logs available yet...'}</pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debug Data Tab */}
        <TabsContent value="debug" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Debug Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="text-sm overflow-x-auto">
                  {JSON.stringify(trainingJob.debugData, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Training Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Model Parameters</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Base Model</span>
                      <span className="text-sm font-mono">{trainingJob.trainingParams.baseModel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Training Steps</span>
                      <span className="text-sm font-mono">{trainingJob.trainingParams.steps}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Learning Rate</span>
                      <span className="text-sm font-mono">{trainingJob.trainingParams.learningRate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">LoRA Rank</span>
                      <span className="text-sm font-mono">{trainingJob.trainingParams.loraRank}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Resource Usage</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Training Images</span>
                      <span className="text-sm font-mono">{trainingJob.trainingImages}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Credits Used</span>
                      <span className="text-sm font-mono">{trainingJob.creditsUsed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Estimated Cost</span>
                      <span className="text-sm font-mono">${trainingJob.estimatedCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Auto Refresh</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={cn(
                          "text-xs",
                          autoRefresh ? "text-green-600" : "text-gray-600"
                        )}
                      >
                        {autoRefresh ? 'ON' : 'OFF'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 