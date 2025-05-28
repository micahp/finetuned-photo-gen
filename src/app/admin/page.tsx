'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Search, Calendar, Users, Activity, 
  ExternalLink, Trash2, RefreshCw, Shield 
} from 'lucide-react'

interface AdminModel {
  id: string
  name: string
  status: string
  userId: string
  userEmail: string
  userName: string | null
  triggerWord?: string
  externalTrainingService?: string
  externalTrainingId?: string
  modelId?: string
  huggingfaceRepo?: string
  trainingStartedAt?: string
  trainingCompletedAt?: string
  createdAt: string
  _count: {
    trainingImages: number
    generatedImages: number
  }
  validationStatus?: string
  validationErrorType?: string
}

export default function AdminPage() {
  const { data: session } = useSession()
  const [models, setModels] = useState<AdminModel[]>([])
  const [filteredModels, setFilteredModels] = useState<AdminModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchAdminModels()
  }, [])

  useEffect(() => {
    filterModels()
  }, [models, searchQuery, statusFilter])

  const fetchAdminModels = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/models')
      
      if (!response.ok) {
        throw new Error('Failed to fetch admin models')
      }

      const data = await response.json()
      setModels(data.models || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin models')
    } finally {
      setLoading(false)
    }
  }

  const filterModels = () => {
    let filtered = models

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(model => 
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (model.userName && model.userName.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(model => model.status === statusFilter)
    }

    setFilteredModels(filtered)
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusCounts = () => {
    const counts = models.reduce((acc, model) => {
      acc[model.status] = (acc[model.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      total: models.length,
      pending: counts.pending || 0,
      training: counts.training || 0,
      ready: counts.ready || 0,
      failed: counts.failed || 0,
    }
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600">Admin Access Required</h2>
          <p className="text-gray-500 mt-2">Please log in with an admin account</p>
        </div>
      </div>
    )
  }

  // Check if user is actually an admin
  if (!session.user.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-600">Access Denied</h2>
          <p className="text-gray-500 mt-2">You don't have admin privileges</p>
          <p className="text-gray-400 text-sm mt-1">Contact an administrator for access</p>
        </div>
      </div>
    )
  }

  const statusCounts = getStatusCounts()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Admin Panel
          </h1>
          <p className="text-gray-600 mt-2">
            Monitor all models across all users
          </p>
        </div>
        <Button onClick={fetchAdminModels} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Models</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Training</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{statusCounts.training}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ready</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statusCounts.ready}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statusCounts.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by model name, user email, or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="training">Training</option>
          <option value="ready">Ready</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Models Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Models ({filteredModels.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-4 border rounded">
                  <Skeleton className="h-6 w-1/3 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No models found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredModels.map((model) => (
                <div key={model.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{model.name}</h3>
                        <Badge className={getStatusColor(model.status)}>
                          {model.status}
                        </Badge>
                        {model.externalTrainingService && (
                          <Badge variant="outline" className="text-xs">
                            {model.externalTrainingService}
                          </Badge>
                        )}
                        {model.validationStatus === 'invalid' && model.validationErrorType === 'corrupted_safetensors' && (
                          <Badge variant="destructive" className="text-xs">
                            Corrupted
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        User: {model.userName || 'Unknown'} ({model.userEmail})
                      </p>
                      {model.triggerWord && (
                        <p className="text-sm text-gray-600">
                          Trigger: <code className="bg-gray-100 px-1 rounded">{model.triggerWord}</code>
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <p>Created: {formatDate(model.createdAt)}</p>
                      {model.trainingStartedAt && (
                        <p>Started: {formatDate(model.trainingStartedAt)}</p>
                      )}
                      {model.trainingCompletedAt && (
                        <p>Completed: {formatDate(model.trainingCompletedAt)}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex gap-6 text-sm text-gray-600">
                      <span>Training Images: {model._count.trainingImages}</span>
                      <span>Generated Images: {model._count.generatedImages}</span>
                      {model.modelId && (
                        <span>Model ID: <code className="text-xs">{model.modelId}</code></span>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {model.huggingfaceRepo && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 w-8 p-0"
                        >
                          <a
                            href={`https://huggingface.co/${model.huggingfaceRepo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 