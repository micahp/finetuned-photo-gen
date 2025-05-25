'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Search, 
  Calendar, 
  Play, 
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Settings,
  DollarSign,
  Activity,
  Filter,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
}

interface FilterState {
  search: string
  status: string
  dateRange: string
  sortBy: string
}

const statusConfig = {
  starting: { label: 'Starting', icon: Play, color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  training: { label: 'Training', icon: Activity, color: 'bg-yellow-500', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700' },
  uploading: { label: 'Uploading', icon: RefreshCw, color: 'bg-purple-500', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700' },
  failed: { label: 'Failed', icon: XCircle, color: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700' },
}

export default function TrainingPage() {
  const { data: session } = useSession()
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([])
  const [filteredJobs, setFilteredJobs] = useState<TrainingJob[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [backgroundUpdating, setBackgroundUpdating] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    dateRange: 'all',
    sortBy: 'newest'
  })
  const [selectedJob, setSelectedJob] = useState<TrainingJob | null>(null)

  // Fetch training jobs from API
  const fetchTrainingJobs = useCallback(async (isBackgroundUpdate = false) => {
    try {
      // Only show loading spinner on initial load, not background updates
      if (!isBackgroundUpdate) {
        setLoading(true)
      } else {
        setBackgroundUpdating(true)
      }
      
      const params = new URLSearchParams()
      if (filters.status !== 'all') {
        params.append('status', filters.status)
      }
      
      const response = await fetch(`/api/training/jobs?${params.toString()}`)
      const data = await response.json()
      
      if (data.success) {
        setTrainingJobs(data.jobs)
        setFilteredJobs(data.jobs)
      } else {
        console.error('Failed to fetch training jobs:', data.error)
        // Don't clear existing data on background update failures
        if (!isBackgroundUpdate) {
          setTrainingJobs([])
          setFilteredJobs([])
        }
      }
    } catch (error) {
      console.error('Failed to fetch training jobs:', error)
      // Don't clear existing data on background update failures
      if (!isBackgroundUpdate) {
        setTrainingJobs([])
        setFilteredJobs([])
      }
    } finally {
      // Only hide loading spinner if this was initial load
      if (!isBackgroundUpdate) {
        setLoading(false)
      } else {
        setBackgroundUpdating(false)
      }
    }
  }, [filters.status])

  useEffect(() => {
    if (session?.user) {
      fetchTrainingJobs()
    }
  }, [session, fetchTrainingJobs])

  // Auto-refresh for active training jobs
  useEffect(() => {
    const hasActiveJobs = trainingJobs.some(job => 
      ['starting', 'training', 'uploading'].includes(job.status)
    )
    
    if (!hasActiveJobs) {
      return
    }

    const interval = setInterval(() => {
      fetchTrainingJobs(true) // Background update - no loading spinner
    }, 15000) // Refresh every 15 seconds for list view

    return () => clearInterval(interval)
  }, [trainingJobs, fetchTrainingJobs])

  // Apply filters
  useEffect(() => {
    let filtered = [...trainingJobs]

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(job => 
        job.modelName.toLowerCase().includes(filters.search.toLowerCase()) ||
        job.id.toLowerCase().includes(filters.search.toLowerCase())
      )
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(job => job.status === filters.status)
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date()
      const cutoffDate = new Date()
      
      switch (filters.dateRange) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          cutoffDate.setDate(now.getDate() - 7)
          break
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1)
          break
      }
      
      filtered = filtered.filter(job => 
        new Date(job.createdAt) >= cutoffDate
      )
    }

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'name':
          return a.modelName.localeCompare(b.modelName)
        case 'progress':
          return b.progress - a.progress
        default:
          return 0
      }
    })

    setFilteredJobs(filtered)
  }, [trainingJobs, filters])

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const refreshJobs = async () => {
    setRefreshing(true)
    await fetchTrainingJobs(true) // Background update - no loading spinner
    setRefreshing(false)
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Training Management</h1>
            <p className="text-gray-600 mt-2">Monitor and manage your LoRA training jobs</p>
          </div>
          <div className="flex items-center space-x-2">
            {backgroundUpdating && (
              <div className="flex items-center text-sm text-gray-500">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                <span>Updating...</span>
              </div>
            )}
            <Button onClick={refreshJobs} disabled={refreshing} className="flex items-center gap-2">
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Training</p>
                <p className="text-2xl font-bold text-gray-900">
                  {trainingJobs.filter(job => ['starting', 'training', 'uploading'].includes(job.status)).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {trainingJobs.filter(job => job.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <XCircle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {trainingJobs.filter(job => job.status === 'failed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${trainingJobs.reduce((sum, job) => sum + job.estimatedCost, 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by model name or training ID..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="starting">Starting</SelectItem>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="uploading">Uploading</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.dateRange} onValueChange={(value) => handleFilterChange('dateRange', value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Training Jobs List */}
      <div className="space-y-4">
        {filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No training jobs found</h3>
              <p className="text-gray-600 mb-4">
                {filters.search || filters.status !== 'all' || filters.dateRange !== 'all'
                  ? 'Try adjusting your filters to see more results.'
                  : 'Start training your first model to see training jobs here.'
                }
              </p>
              <Link href="/dashboard/models/new">
                <Button>Create New Model</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          filteredJobs.map((job) => {
            const statusIcon = getStatusIcon(job.status)
            const StatusIcon = statusIcon.icon

            return (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className={cn("p-2 rounded-full", statusIcon.bgColor)}>
                        <StatusIcon className={cn("h-5 w-5", statusIcon.textColor)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {job.modelName}
                          </h3>
                          <Badge variant="outline" className={cn("", statusIcon.textColor)}>
                            {statusIcon.label}
                          </Badge>
                          {job.huggingFaceRepo && (
                            <Badge variant="secondary">
                              <a 
                                href={`https://huggingface.co/${job.huggingFaceRepo}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                HF Model
                              </a>
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 mt-1">
                          {/* Use parsed log progress for better stage descriptions */}
                          {job.debugData?.logProgress?.stageDescription || job.stage}
                          {job.debugData?.logProgress?.currentStep && job.debugData?.logProgress?.totalSteps && (
                            <span className="text-xs text-gray-500 ml-2">
                              ({job.debugData.logProgress.currentStep}/{job.debugData.logProgress.totalSteps} steps)
                            </span>
                          )}
                        </p>
                        
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <span>ID: {job.id}</span>
                          <span>•</span>
                          <span>{job.trainingImages} images</span>
                          <span>•</span>
                          <span>{job.creditsUsed} credits</span>
                          <span>•</span>
                          <span>${job.estimatedCost.toFixed(2)}</span>
                          <span>•</span>
                          <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                          {job.estimatedTimeRemaining && (
                            <>
                              <span>•</span>
                              <span>{formatTimeRemaining(job.estimatedTimeRemaining)}</span>
                            </>
                          )}
                        </div>

                        {/* Progress Bar */}
                        {['starting', 'training', 'uploading'].includes(job.status) && (
                          <div className="mt-3">
                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                              <span>Progress</span>
                              <span>{job.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                                style={{ width: `${job.progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Error Display */}
                        {job.error && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                            <div className="flex items-center">
                              <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                              <span className="text-sm text-red-700">{job.error}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Link href={`/dashboard/training/${job.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
} 