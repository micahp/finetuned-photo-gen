'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Plus, Image, Calendar, Loader2, ExternalLink, DollarSign, Clock, Users, Zap, Activity, AlertCircle, Trash2, RefreshCw, Crown, CheckCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  AlertDialog,
  AlertDialogAction, 
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { isPremiumUser } from '@/lib/subscription-utils'

interface Model {
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
  _count: {
    trainingImages: number
    generatedImages: number
  }
}

interface TrainingStatus {
  id: string
  status: 'starting' | 'training' | 'uploading' | 'completed' | 'failed'
  progress: number
  stage: string
  estimatedTimeRemaining?: number
  cost?: number
  debugData?: any
}

interface DeletePreview {
  id: string
  name: string
  status: string
  trainingImagesCount: number
  generatedImagesCount: number
  huggingfaceRepo?: string
  hasZipFiles: boolean
}

export default function ModelsPage() {
  const { data: session } = useSession()
  const [models, setModels] = useState<Model[]>([])
  const [trainingStatuses, setTrainingStatuses] = useState<Record<string, TrainingStatus>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null)
  const [retryingUpload, setRetryingUpload] = useState<string | null>(null)
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)

  useEffect(() => {
    setHasPremiumAccess(isPremiumUser(session?.user?.subscriptionPlan, session?.user?.subscriptionStatus))
  }, [session?.user?.subscriptionPlan, session?.user?.subscriptionStatus])

  useEffect(() => {
    fetchModels()
  }, [])

  const fetchModels = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/models')
      
      if (!response.ok) {
        throw new Error('Failed to fetch models')
      }

      const data = await response.json()
      const fetchedModels = data.models || []
      setModels(fetchedModels)
      
      // Fetch training status for models that are currently training
      for (const model of fetchedModels) {
        if (model.status === 'training' && model.externalTrainingId) {
          await fetchTrainingStatus(model.id, model.externalTrainingId)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models')
    } finally {
      setLoading(false)
    }
  }

  const fetchTrainingStatus = async (modelId: string, trainingId: string) => {
    try {
      const response = await fetch('/api/training/jobs/' + trainingId)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.job) {
          setTrainingStatuses(prev => ({
            ...prev,
            [modelId]: {
              id: data.job.id,
              status: data.job.status,
              progress: data.job.progress || 0,
              stage: data.job.stage || 'Unknown',
              cost: data.job.cost,
              debugData: data.job.debugData
            }
          }))
        }
      }
    } catch (error) {
      console.error('Failed to fetch training status:', error)
    }
  }

  const refreshModelStatus = async (modelId: string) => {
    setRefreshing(modelId)
    try {
      const model = models.find(m => m.id === modelId)
      if (model?.externalTrainingId) {
        await fetchTrainingStatus(modelId, model.externalTrainingId)
      }
    } finally {
      setRefreshing(null)
    }
  }

  const handleDeleteClick = async (modelId: string) => {
    try {
      // Fetch deletion preview
      const response = await fetch(`/api/models/${modelId}/delete`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.preview) {
          // Add the modelId to the preview since it's not included in the API response
          setDeletePreview({
            ...data.preview,
            id: modelId
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch deletion preview:', error)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletePreview) return
    
    setDeleting(deletePreview.id)
    try {
      const response = await fetch(`/api/models/${deletePreview.id}/delete`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.success) {
        // Remove model from state
        setModels(prev => prev.filter(m => m.id !== deletePreview.id))
        setDeletePreview(null)
        
        // Show success message
        console.log('Model deleted successfully:', data.details)
      } else {
        setError(data.error || 'Failed to delete model')
      }
    } catch (error) {
      setError('Failed to delete model')
      console.error('Delete error:', error)
    } finally {
      setDeleting(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'training':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'ready':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'training':
        return <Loader2 className="h-3 w-3 animate-spin" />
      case 'ready':
        return <Zap className="h-3 w-3" />
      case 'failed':
        return <AlertCircle className="h-3 w-3" />
      default:
        return <Clock className="h-3 w-3" />
    }
  }

  const calculateTrainingCost = (imageCount: number) => {
    const baseCost = 1.25 // Base cost
    const perImageCost = 0.15 // Cost per image
    return baseCost + (imageCount * perImageCost)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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

  const startSubscriptionCheckout = async () => {
    try {
      setIsSubscribing(true)
      setError(null)

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: 'creator', // plan id resolves to correct price id server-side
          mode: 'subscription',
          quantity: 1,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { url, sessionId } = await response.json()
      if (url) {
        if (sessionId) {
          localStorage.setItem('stripe_checkout_session', sessionId)
          localStorage.setItem('checkout_return_time', Date.now().toString())
        }
        window.location.replace(url)
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (err) {
      console.error('Failed to create checkout session:', err)
      setError('Failed to start checkout process. Please try again.')
      setIsSubscribing(false)
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-600">Please log in to view your models</h2>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Models</h1>
            <p className="text-gray-600 mt-2">
              Manage your custom AI models and training datasets
            </p>
          </div>
          <div className="flex gap-3">
            {hasPremiumAccess ? (
              <>
                <Link href="/dashboard/training">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Training Dashboard
                  </Button>
                </Link>
                <Link href="/dashboard/models/new">
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create New Model
                  </Button>
                </Link>
              </>
            ) : (
              <Button
                onClick={startSubscriptionCheckout}
                disabled={isSubscribing}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4" />
                    Subscribe to Create Your First Model
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-8 w-1/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : models.length === 0 ? (
          <div className="text-center py-12">
            {hasPremiumAccess ? (
              <div className="max-w-md mx-auto">
                <Image className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No models yet</h3>
                <p className="text-gray-600 mb-6">
                  Create your first custom model to start generating personalized images
                </p>
                <Link href="/dashboard/models/new">
                  <Button className="flex items-center gap-2 mx-auto">
                    <Plus className="h-4 w-4" />
                    Create Your First Model
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto">
                <Card className="border-2 border-blue-200 shadow-md">
                  <CardHeader className="border-b border-blue-200 bg-blue-100/50">
                    <CardTitle className="flex items-center text-blue-800">
                      <Crown className="h-5 w-5 mr-2" />
                      Unlock Custom AI Models
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-6">
                      <div className="flex flex-col items-center text-center">
                        <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                          <Image className="h-10 w-10 text-purple-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Your Personal AI Models</h3>
                        <p className="text-gray-600 mb-4">
                          Upgrade to premium and unlock the ability to train custom AI models with your own photos.
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center p-3 border border-blue-200 rounded-md bg-white">
                          <div className="mr-3 text-xl opacity-70">📸</div>
                          <div className="text-sm font-medium text-gray-700">Train with your photos</div>
                        </div>
                        <div className="flex items-center p-3 border border-blue-200 rounded-md bg-white">
                          <div className="mr-3 text-xl opacity-70">🎯</div>
                          <div className="text-sm font-medium text-gray-700">Personalized results</div>
                        </div>
                        <div className="flex items-center p-3 border border-blue-200 rounded-md bg-white">
                          <div className="mr-3 text-xl opacity-70">⚡</div>
                          <div className="text-sm font-medium text-gray-700">Fast training</div>
                        </div>
                        <div className="flex items-center p-3 border border-blue-200 rounded-md bg-white">
                          <div className="mr-3 text-xl opacity-70">🎨</div>
                          <div className="text-sm font-medium text-gray-700">Multiple styles</div>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-b from-blue-50 to-white p-6 rounded-lg border border-blue-200 shadow-sm">
                        <div className="flex items-center justify-center mb-4">
                          <Badge className="bg-blue-100 text-blue-800 border-none">Most Popular</Badge>
                        </div>
                        <div className="text-center">
                          <h3 className="text-lg font-semibold text-gray-900">Creator Plan</h3>
                          <div className="mt-2 mb-1">
                            <span className="text-3xl font-bold text-blue-600">$20</span>
                            <span className="text-gray-500">/month</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-4">200 credits monthly</p>
                        </div>
                        
                        <h4 className="font-medium text-gray-900 mb-3">Model Training Features:</h4>
                        <ul className="space-y-2 mb-6">
                          <li className="flex items-center text-sm">
                            <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                              <CheckCircle className="h-3 w-3 text-blue-600" />
                            </div>
                            <span className="text-gray-600">Train up to 3 custom models</span>
                          </li>
                          <li className="flex items-center text-sm">
                            <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                              <CheckCircle className="h-3 w-3 text-blue-600" />
                            </div>
                            <span className="text-gray-600">High-quality training with 20-30 photos</span>
                          </li>
                          <li className="flex items-center text-sm">
                            <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                              <CheckCircle className="h-3 w-3 text-blue-600" />
                            </div>
                            <span className="text-gray-600">Fast training completion (15-30 minutes)</span>
                          </li>
                          <li className="flex items-center text-sm">
                            <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                              <CheckCircle className="h-3 w-3 text-blue-600" />
                            </div>
                            <span className="text-gray-600">Priority training queue</span>
                          </li>
                        </ul>
                        
                        <Button 
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                          size="lg"
                          onClick={async () => {
                            try {
                              setIsSubscribing(true)
                              setError(null)
                              
                              const response = await fetch('/api/stripe/create-checkout-session', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  priceId: process.env.NEXT_PUBLIC_STRIPE_CREATOR_PLAN_PRICE_ID || 'price_creator',
                                  mode: 'subscription',
                                  quantity: 1
                                }),
                              })
                              
                              if (!response.ok) {
                                throw new Error('Failed to create checkout session')
                              }
                              
                              const { url, sessionId } = await response.json()
                              
                              if (url) {
                                if (sessionId) {
                                  localStorage.setItem('stripe_checkout_session', sessionId)
                                  localStorage.setItem('checkout_return_time', Date.now().toString())
                                }
                                window.location.replace(url)
                              } else {
                                throw new Error('No checkout URL returned')
                              }
                            } catch (error) {
                              console.error('Failed to create checkout session:', error)
                              setError('Failed to start checkout process. Please try again.')
                              setIsSubscribing(false)
                            }
                          }}
                          disabled={isSubscribing}
                        >
                          {isSubscribing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Redirecting...
                            </>
                          ) : (
                            <>
                              <Crown className="h-4 w-4 mr-2" />
                              Subscribe to Create Your First Model
                            </>
                          )}
                        </Button>
                        
                        <p className="text-xs text-center text-gray-500 mt-3">
                          Cancel anytime with no hidden fees
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {models.map((model) => {
              const trainingStatus = trainingStatuses[model.id]
              const trainingCost = calculateTrainingCost(model._count.trainingImages)
              const duration = formatDuration(model.trainingStartedAt, model.trainingCompletedAt)
              
              return (
                <Card key={model.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg truncate">{model.name}</CardTitle>
                        {model.triggerWord && (
                          <p className="text-sm text-gray-500 mt-1">
                            Trigger: <code className="bg-gray-100 px-1 rounded">{model.triggerWord}</code>
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={`${getStatusColor(model.status)} flex items-center gap-1`}>
                          {getStatusIcon(model.status)}
                          {model.status}
                        </Badge>
                        {model.status === 'training' && trainingStatus && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => refreshModelStatus(model.id)}
                            disabled={refreshing === model.id}
                            className="h-6 px-2"
                          >
                            {refreshing === model.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Refresh'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      Created {formatDate(model.createdAt)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Training Progress */}
                    {model.status === 'training' && trainingStatus && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-blue-900">Training Progress</span>
                          <span className="text-sm text-blue-700">{trainingStatus.progress}%</span>
                        </div>
                        <Progress value={trainingStatus.progress} className="mb-2" />
                        <p className="text-xs text-blue-700">Stage: {trainingStatus.stage}</p>
                      </div>
                    )}

                    {/* Model Statistics */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Training Images:</span>
                        <span className="font-medium">{model._count.trainingImages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Generated Images:</span>
                        <span className="font-medium">{model._count.generatedImages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Training Cost:
                        </span>
                        <span className="font-medium">${trainingCost.toFixed(2)}</span>
                      </div>
                      {duration && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Duration:
                          </span>
                          <span className="font-medium">{duration}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-4">
                      <Link href={`/dashboard/models/${model.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          View Details
                        </Button>
                      </Link>
                      {model.status === 'ready' && model.loraReadyForInference && (
                        <Link href={`/dashboard/generate?model=${model.id}`} className="flex-1">
                          <Button size="sm" className="w-full">
                            Generate
                          </Button>
                        </Link>
                      )}
                      {model.status === 'training' && model.externalTrainingId && (
                        <Link href={`/dashboard/training/${model.externalTrainingId}`} className="flex-1">
                          <Button size="sm" variant="outline" className="w-full">
                            Monitor
                          </Button>
                        </Link>
                      )}
                      
                      {/* Delete Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(model.id)}
                            disabled={deleting === model.id}
                            className="px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {deleting === model.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete Model</TooltipContent>
                      </Tooltip>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <AlertDialog open={!!deletePreview} onOpenChange={(open) => !open && setDeletePreview(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Model: {deletePreview?.name}</AlertDialogTitle>
              <AlertDialogDescription>
                This action will permanently delete this model and clean up all associated resources. 
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            {deletePreview && (
              <div className="my-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-sm text-gray-900 mb-3">What will be deleted:</h4>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <span className="text-red-500">✗</span>
                    Model configuration and metadata
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-500">✗</span>
                    {deletePreview.trainingImagesCount || 0} training images
                  </li>
                </ul>
                
                <h4 className="font-semibold text-sm text-green-900 mt-4 mb-2">What will be preserved:</h4>
                <ul className="space-y-1 text-sm text-green-700">
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    {deletePreview.generatedImagesCount || 0} generated images (will remain in your gallery)
                  </li>
                </ul>
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={!!deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  'Delete Model'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
