'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  CreditCard, 
  TrendingUp, 
  Image as ImageIcon, 
  Cpu, 
  AlertTriangle,
  Calendar,
  DollarSign
} from 'lucide-react'

interface UsageAnalytics {
  currentPeriod: {
    creditsUsed: number
    creditsRemaining: number
    imagesGenerated: number
    modelsCreated: number
    percentageUsed: number
  }
  allTime: {
    totalCreditsUsed: number
    totalCreditsEarned: number
    totalImagesGenerated: number
    totalModelsCreated: number
    totalSpent: number
  }
  recentTransactions: Array<{
    id: string
    amount: number
    type: 'earned' | 'spent' | 'purchased' | 'subscription_renewal' | 'refund' | 'admin_adjustment'
    description: string
    createdAt: string
    balanceAfter: number
  }>
  usageTrends: Array<{
    date: string
    creditsUsed: number
    imagesGenerated: number
  }>
}

interface UsageLimits {
  maxCreditsPerMonth: number
  maxModels: number
  currentCredits: number
  currentModels: number
  canCreateModel: boolean
  canGenerateImage: boolean
  warningThreshold: number
  isNearLimit: boolean
}

interface LowCreditNotification {
  shouldNotify: boolean
  message: string
  severity: 'warning' | 'critical'
  creditsRemaining: number
  suggestedAction: string
}

export function UsageAnalytics() {
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null)
  const [limits, setLimits] = useState<UsageLimits | null>(null)
  const [notification, setNotification] = useState<LowCreditNotification | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnalytics()
    fetchLimits()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/dashboard/usage-analytics')
      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }
      const data = await response.json()
      setAnalytics(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics')
    }
  }

  const fetchLimits = async () => {
    try {
      const response = await fetch('/api/dashboard/usage-limits')
      if (!response.ok) {
        throw new Error('Failed to fetch limits')
      }
      const data = await response.json()
      setLimits(data.data.limits)
      setNotification(data.data.notification)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch limits')
      setLoading(false)
    }
  }

  const formatTransactionType = (type: string) => {
    switch (type) {
      case 'earned': return 'Earned'
      case 'spent': return 'Spent'
      case 'purchased': return 'Purchased'
      case 'subscription_renewal': return 'Subscription'
      case 'refund': return 'Refund'
      case 'admin_adjustment': return 'Adjustment'
      default: return type
    }
  }

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'earned':
      case 'purchased':
      case 'subscription_renewal':
      case 'refund':
        return 'text-green-600'
      case 'spent':
        return 'text-red-600'
      case 'admin_adjustment':
        return 'text-blue-600'
      default:
        return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-16 animate-pulse mb-2" />
                <div className="h-3 bg-gray-200 rounded w-32 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Error loading analytics: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!analytics || !limits) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Low Credit Warning */}
      {notification?.shouldNotify && (
        <Card className={`border-l-4 ${notification.severity === 'critical' ? 'border-l-red-500 bg-red-50' : 'border-l-yellow-500 bg-yellow-50'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className={`h-5 w-5 ${notification.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'}`} />
              <div>
                <p className={`font-medium ${notification.severity === 'critical' ? 'text-red-800' : 'text-yellow-800'}`}>
                  {notification.message}
                </p>
                <p className={`text-sm ${notification.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'}`}>
                  {notification.suggestedAction}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Remaining</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.currentPeriod.creditsRemaining}</div>
            <div className="space-y-2">
              <Progress 
                value={100 - analytics.currentPeriod.percentageUsed} 
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {analytics.currentPeriod.creditsUsed} of {limits.maxCreditsPerMonth} used this month
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Images Generated</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.currentPeriod.imagesGenerated}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.allTime.totalImagesGenerated} total images
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Models Created</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{limits.currentModels}</div>
            <p className="text-xs text-muted-foreground">
              {limits.maxModels - limits.currentModels} slots available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.allTime.totalSpent.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.allTime.totalCreditsUsed} credits used
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          <TabsTrigger value="trends">Usage Trends</TabsTrigger>
          <TabsTrigger value="limits">Usage Limits</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Your latest credit transactions and activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.recentTransactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No transactions yet
                  </p>
                ) : (
                  analytics.recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between border-b pb-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{transaction.description}</p>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {formatTransactionType(transaction.type)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${getTransactionColor(transaction.type)}`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount} credits
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Balance: {transaction.balanceAfter}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage Trends</CardTitle>
              <CardDescription>
                Your credit usage and image generation over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.usageTrends.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No usage data available yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {analytics.usageTrends.slice(0, 10).map((trend, index) => (
                      <div key={trend.date} className="flex items-center justify-between py-2 border-b">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{new Date(trend.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm">
                          <span className="text-red-600">-{trend.creditsUsed} credits</span>
                          <span className="text-blue-600">{trend.imagesGenerated} images</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage Limits & Permissions</CardTitle>
              <CardDescription>
                Your current plan limits and available actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Monthly Credits</span>
                      <span className="text-sm text-muted-foreground">
                        {analytics.currentPeriod.creditsUsed} / {limits.maxCreditsPerMonth}
                      </span>
                    </div>
                    <Progress value={analytics.currentPeriod.percentageUsed} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Model Slots</span>
                      <span className="text-sm text-muted-foreground">
                        {limits.currentModels} / {limits.maxModels}
                      </span>
                    </div>
                    <Progress value={(limits.currentModels / limits.maxModels) * 100} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-2">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Generate Images</span>
                    </div>
                    <Badge variant={limits.canGenerateImage ? "default" : "destructive"}>
                      {limits.canGenerateImage ? "Available" : "Unavailable"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Cpu className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Create Models</span>
                    </div>
                    <Badge variant={limits.canCreateModel ? "default" : "destructive"}>
                      {limits.canCreateModel ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                </div>

                {limits.isNearLimit && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">
                          Approaching Credit Limit
                        </p>
                        <p className="text-sm text-yellow-600">
                          You have {limits.currentCredits} credits remaining (warning threshold: {limits.warningThreshold})
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 