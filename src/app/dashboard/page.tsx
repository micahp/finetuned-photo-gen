'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { Sparkles, Camera, Crown, Clock, ExternalLink } from 'lucide-react'

interface DashboardStats {
  user: {
    credits: number
    subscriptionStatus: string
    subscriptionPlan: string | null
    memberSince: string
  }
  stats: {
    imagesGenerated: number
    modelsCount: number
    totalCreditsUsed: number
  }
  recentActivity: Array<{
    id: string
    type: string
    prompt: string
    imageUrl: string
    createdAt: string
    creditsUsed: number
    model: string
  }>
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchDashboardStats()
    }
  }, [status])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard/stats')
      const result = await response.json()

      if (result.success) {
        setStats(result.data)
      } else {
        setError(result.error || 'Failed to load dashboard data')
      }
    } catch (err) {
      setError('Failed to load dashboard data')
      console.error('Dashboard stats error:', err)
    } finally {
      setLoading(false)
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

  const getSubscriptionBadge = (status: string, plan: string | null) => {
    if (status === 'free') {
      return <Badge variant="secondary">Free Plan</Badge>
    }
    if (status === 'active' && plan) {
      return <Badge variant="default" className="flex items-center gap-1">
        <Crown className="h-3 w-3" />
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </Badge>
    }
    return <Badge variant="outline">{status}</Badge>
  }

  if (status === 'loading' || loading) {
    return <DashboardSkeleton />
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-600">Please log in to view dashboard</h2>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600">Error loading dashboard</h2>
            <p className="text-gray-600 mt-2">{error}</p>
            <Button onClick={fetchDashboardStats} className="mt-4">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-2">
                Welcome back, {session.user?.name || session.user?.email}
              </p>
            </div>
            {stats && (
              <div className="flex items-center gap-2">
                {getSubscriptionBadge(stats.user.subscriptionStatus, stats.user.subscriptionPlan)}
                <Badge variant="outline" className="text-xs">
                  Member since {formatDate(stats.user.memberSince).split(',')[0]}
                </Badge>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Stats Cards */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credits Remaining</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.user.credits || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.user.subscriptionStatus === 'free' ? 'Free tier limit' : 'Monthly credits'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Models Trained</CardTitle>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.stats.modelsCount || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.stats.modelsCount === 0 ? 'Ready to create your first model' : 'Custom AI models'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Images Generated</CardTitle>
              <Camera className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats?.stats.imagesGenerated || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.stats.imagesGenerated === 0 ? 'Start generating today' : 'Total AI-generated images'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credits Used</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats?.stats.totalCreditsUsed || 0}</div>
              <p className="text-xs text-muted-foreground">
                Lifetime total spent
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Create Your First Model</CardTitle>
                <CardDescription>
                  Upload 10-20 photos of yourself to train a personalized AI model
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/dashboard/models/new">
                    Create Model
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Generate Images</CardTitle>
                <CardDescription>
                  Create stunning AI images using FLUX models - no custom model required
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/dashboard/generate">
                    Generate Images
                  </Link>
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Start with base FLUX models or use your trained models
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <Card>
            <CardContent className="p-6">
              {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {stats.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex-shrink-0">
                        <img 
                          src={activity.imageUrl} 
                          alt="Generated image"
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Camera className="h-4 w-4 text-purple-500" />
                          <span className="font-medium text-sm">Image Generated</span>
                          <Badge variant="outline" className="text-xs">{activity.model.split('/').pop()}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          "{activity.prompt}"
                        </p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{formatDate(activity.createdAt)}</span>
                          <div className="flex items-center gap-2">
                            <span>{activity.creditsUsed} credit{activity.creditsUsed !== 1 ? 's' : ''}</span>
                            <Button variant="ghost" size="sm" asChild className="h-6 w-6 p-0">
                              <a href={activity.imageUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Camera className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p>No recent activity yet</p>
                  <p className="text-sm mt-1">
                    Generate your first image to see activity here
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/dashboard/generate">
                      Generate Your First Image
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 