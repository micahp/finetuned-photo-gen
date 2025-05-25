'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  ArrowLeft, Calendar, Clock, DollarSign, ExternalLink, 
  Image, Loader2, Zap, AlertCircle, Users, Activity,
  Download, RefreshCw, Play, Settings, BarChart3
} from 'lucide-react'

interface ModelDetails {
  id: string
  name: string
  status: string
  triggerWord?: string
  userId: string
  createdAt: string
  trainingStartedAt?: string
  trainingCompletedAt?: string
  huggingfaceRepo?: string
  loraReadyForInference: boolean
  externalTrainingId?: string
  externalTrainingService?: string
  trainingImagesCount?: number
  _count: {
    trainingImages: number
    generatedImages: number
  }
  trainingImages: Array<{
    id: string
    originalFilename: string
    s3Key: string
    fileSize: number
    createdAt: string
  }>
  generatedImages: Array<{
    id: string
    prompt: string
    imageUrl: string
    creditsUsed: number
    createdAt: string
  }>
  validationStatus?: string
  validationErrorType?: string
  validationError?: string
}

interface TrainingStatus {
  id: string
  status: 'starting' | 'training' | 'uploading' | 'completed' | 'failed'
  progress: number
  stage: string
  estimatedTimeRemaining?: number
  cost?: number
  debugData?: any
  logs?: string
}

export default function ModelDetailsPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const modelId = params.id as string

  const [model, setModel] = useState<ModelDetails | null>(null)
  const [trainingStatus, setTrainingStatus] = useState<TrainingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (modelId) {
      fetchModelDetails()
    }
  }, [modelId])

  useEffect(() => {
    // Auto-refresh for training models
    if (model?.status === 'training' && model.externalTrainingId) {
      const interval = setInterval(() => {
        fetchTrainingStatus(true)
      }, 10000) // Refresh every 10 seconds

      return () => clearInterval(interval)
    }
  }, [model])

  const fetchModelDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/models/${modelId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch model details')
      }

      const data = await response.json()
      setModel(data.model)
      
      // Fetch training status if applicable
      if (data.model?.status === 'training' && data.model.externalTrainingId) {
        await fetchTrainingStatus()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model')
    } finally {
      setLoading(false)
    }
  }

  const fetchTrainingStatus = async (silent = false) => {
    if (!model?.externalTrainingId) return

    try {
      if (!silent) setRefreshing(true)
      const response = await fetch(`/api/training/jobs/${model.externalTrainingId}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.job) {
          setTrainingStatus({
            id: data.job.id,
            status: data.job.status,
            progress: data.job.progress || 0,
            stage: data.job.stage || 'Unknown',
            cost: data.job.cost,
            debugData: data.job.debugData,
            logs: data.job.logs
          })
          
          // Update model status if completed
          if (data.job.status === 'completed' || data.job.status === 'failed') {
            setModel(prev => prev ? { ...prev, status: data.job.status } : null)
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch training status:', error)
    } finally {
      if (!silent) setRefreshing(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'training': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'ready': return 'bg-green-100 text-green-800 border-green-200'
      case 'failed': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'training': return <Loader2 className="h-4 w-4 animate-spin" />
      case 'ready': return <Zap className="h-4 w-4" />
      case 'failed': return <AlertCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const calculateTrainingCost = (imageCount: number) => {
    const baseCost = 1.25
    const perImageCost = 0.15
    return baseCost + (imageCount * perImageCost)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (start?: string, end?: string) => {
    if (!start) return null
    const startDate = new Date(start)
    const endDate = end ? new Date(end) : new Date()
    const diffMs = endDate.getTime() - startDate.getTime()
    const minutes = Math.floor(diffMs / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m`
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-600">Please log in to view model details</h2>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !model) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard/models">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Model Not Found</h1>
        </div>
        <div className="text-center py-12">
          <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Model not found</h3>
          <p className="text-gray-600 mb-6">
            {error || "The model you're looking for doesn't exist or you don't have access to it."}
          </p>
          <Link href="/dashboard/models">
            <Button>Back to Models</Button>
          </Link>
        </div>
      </div>
    )
  }

  const trainingCost = calculateTrainingCost(model._count.trainingImages)
  const duration = formatDuration(model.trainingStartedAt, model.trainingCompletedAt)

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/models">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{model.name}</h1>
            <Badge className={`${getStatusColor(model.status)} flex items-center gap-1`}>
              {getStatusIcon(model.status)}
              {model.status}
            </Badge>
          </div>
          {model.triggerWord && (
            <p className="text-gray-600">
              Trigger Word: <code className="bg-gray-100 px-2 py-1 rounded text-sm">{model.triggerWord}</code>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {model.status === 'training' && trainingStatus && (
            <Button 
              variant="outline" 
              onClick={() => fetchTrainingStatus()}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          )}
          {model.status === 'ready' && model.loraReadyForInference && model.validationStatus !== 'invalid' && (
            <Link href={`/dashboard/generate?model=${model.id}`}>
              <Button className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Generate Images
              </Button>
            </Link>
          )}
          {model.status === 'training' && model.externalTrainingId && (
            <Link href={`/dashboard/training/${model.externalTrainingId}`}>
              <Button variant="outline" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Training Monitor
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Model Corruption Warning */}
      {model.status === 'ready' && model.validationStatus === 'invalid' && model.validationErrorType === 'corrupted_safetensors' && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              Model Corrupted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">
              This model cannot be used for image generation. The safetensors file is corrupted and needs to be regenerated. 
              You may need to retrain the model to fix this issue.
            </p>
            {model.validationError && (
              <p className="text-sm text-red-600 mt-2 font-mono bg-red-100 p-2 rounded">
                {model.validationError}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Training Progress (for active training) */}
      {model.status === 'training' && trainingStatus && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Training Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-gray-600">{trainingStatus.progress}%</span>
              </div>
              <Progress value={trainingStatus.progress} className="h-2" />
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Current Stage: {trainingStatus.stage}</span>
                {trainingStatus.estimatedTimeRemaining && (
                  <span className="text-gray-600">
                    ETA: {Math.round(trainingStatus.estimatedTimeRemaining / 60)}m
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="training-images">Training Images</TabsTrigger>
              <TabsTrigger value="generated-images">Generated Images</TabsTrigger>
              {model.status === 'training' && trainingStatus && (
                <TabsTrigger value="logs">Training Logs</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>Model Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Created</label>
                      <p className="text-sm">{formatDate(model.createdAt)}</p>
                    </div>
                    {model.trainingStartedAt && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Training Started</label>
                        <p className="text-sm">{formatDate(model.trainingStartedAt)}</p>
                      </div>
                    )}
                    {model.trainingCompletedAt && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Training Completed</label>
                        <p className="text-sm">{formatDate(model.trainingCompletedAt)}</p>
                      </div>
                    )}
                    {duration && (
                      <div>
                        <label className="text-sm font-medium text-gray-600">Training Duration</label>
                        <p className="text-sm">{duration}</p>
                      </div>
                    )}
                  </div>

                  {model.externalTrainingService && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Training Service</label>
                      <p className="text-sm capitalize">{model.externalTrainingService}</p>
                    </div>
                  )}

                  {model.huggingfaceRepo && (
                    <div className="p-3 bg-green-50 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-800">🤗 HuggingFace Repository</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`https://huggingface.co/${model.huggingfaceRepo}`, '_blank')}
                          className="text-green-700 hover:text-green-900"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-green-700 font-mono">{model.huggingfaceRepo}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="training-images">
              <Card>
                <CardHeader>
                  <CardTitle>Training Images ({model._count.trainingImages})</CardTitle>
                </CardHeader>
                <CardContent>
                  {model.trainingImages.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {model.trainingImages.map((image) => (
                        <div key={image.id} className="space-y-2">
                          <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                            <Image className="h-8 w-8 text-gray-400" />
                          </div>
                          <div className="text-xs space-y-1">
                            <p className="truncate" title={image.originalFilename}>
                              {image.originalFilename}
                            </p>
                            <p className="text-gray-500">{formatFileSize(image.fileSize)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Image className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>No training images found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="generated-images">
              <Card>
                <CardHeader>
                  <CardTitle>Generated Images ({model._count.generatedImages})</CardTitle>
                </CardHeader>
                <CardContent>
                  {model.generatedImages.length > 0 ? (
                    <div className="space-y-4">
                      {model.generatedImages.map((image) => (
                        <div key={image.id} className="flex gap-4 p-3 border rounded-lg">
                          <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                            <Image className="h-6 w-6 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{image.prompt}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(image.createdAt)} • {image.creditsUsed} credit{image.creditsUsed !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Zap className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>No images generated with this model yet</p>
                      {model.status === 'ready' && (
                        <Link href={`/dashboard/generate?model=${model.id}`} className="mt-3 inline-block">
                          <Button size="sm">Generate First Image</Button>
                        </Link>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {model.status === 'training' && trainingStatus && (
              <TabsContent value="logs">
                <Card>
                  <CardHeader>
                    <CardTitle>Training Logs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                      {trainingStatus.logs ? (
                        <pre className="whitespace-pre-wrap">{trainingStatus.logs}</pre>
                      ) : (
                        <p className="text-gray-500">No logs available yet...</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Training Images</span>
                  <span className="font-medium">{model._count.trainingImages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Generated Images</span>
                  <span className="font-medium">{model._count.generatedImages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Training Cost
                  </span>
                  <span className="font-medium">${trainingCost.toFixed(2)}</span>
                </div>
                {trainingStatus?.cost && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Actual Cost</span>
                    <span className="font-medium">${trainingStatus.cost.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {model.status === 'ready' && model.loraReadyForInference && (
                <Link href={`/dashboard/generate?model=${model.id}`} className="block">
                  <Button className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Generate Images
                  </Button>
                </Link>
              )}
              {model.status === 'training' && model.externalTrainingId && (
                <Link href={`/dashboard/training/${model.externalTrainingId}`} className="block">
                  <Button variant="outline" className="w-full">
                    <Activity className="h-4 w-4 mr-2" />
                    Training Monitor
                  </Button>
                </Link>
              )}
              {model.huggingfaceRepo && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.open(`https://huggingface.co/${model.huggingfaceRepo}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on HuggingFace
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 