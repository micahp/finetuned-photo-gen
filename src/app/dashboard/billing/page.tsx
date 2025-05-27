'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
// import { Separator } from '@/components/ui/separator'
// import { Alert, AlertDescription } from '@/components/ui/alert'
import { PricingCard } from '@/components/billing/pricing-card'
import { PRICING_PLANS, getCurrentPlan } from '@/lib/stripe/pricing'
import { toast } from 'sonner'
import { 
  CreditCard, 
  Calendar, 
  Crown, 
  ExternalLink, 
  CheckCircle, 
  XCircle,
  Loader2
} from 'lucide-react'

export default function BillingPage() {
  const { data: session, status, update } = useSession()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  // Handle success/cancel from Stripe checkout
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const canceled = searchParams.get('canceled')

    if (sessionId) {
      toast.success('Subscription successful! Your account has been updated.')
      // Refresh session to get updated subscription data
      update()
    } else if (canceled) {
      toast.info('Subscription canceled. You can try again anytime.')
    }
  }, [searchParams, update])

  const handleSubscribe = async (priceId: string) => {
    if (!session?.user) {
      toast.error('Please sign in to subscribe')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/stripe/create-subscription-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          returnUrl: `${window.location.origin}/dashboard/billing`,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch (error) {
      console.error('Subscription error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to start subscription process')
    } finally {
      setLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    if (!session?.user?.stripeCustomerId) {
      toast.error('No subscription to manage')
      return
    }

    setPortalLoading(true)
    try {
      const response = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to access customer portal')
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url
    } catch (error) {
      console.error('Portal error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to access customer portal')
    } finally {
      setPortalLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-600">Please log in to view billing</h2>
        </div>
      </div>
    )
  }

  const currentPlan = getCurrentPlan(session.user.subscriptionPlan)
  const isSubscribed = session.user.subscriptionStatus === 'active'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-gray-600 mt-2">
            Manage your subscription and billing information
          </p>
        </div>

        {/* Current Subscription Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Current Subscription
            </CardTitle>
            <CardDescription>
              Your current plan and usage information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{currentPlan.name} Plan</h3>
                <p className="text-gray-600">{currentPlan.description}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  ${currentPlan.price}
                  {currentPlan.price > 0 && <span className="text-sm text-gray-500">/month</span>}
                </div>
                <Badge variant={isSubscribed ? 'default' : 'secondary'}>
                  {session.user.subscriptionStatus === 'active' ? 'Active' : 'Free'}
                </Badge>
              </div>
            </div>

            <hr className="border-gray-200" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {session.user.credits?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-600">Credits Remaining</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {currentPlan.credits.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Monthly Credits</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {currentPlan.maxModels}
                </div>
                <div className="text-sm text-gray-600">Model Slots</div>
              </div>
            </div>

            {isSubscribed && (
              <div className="pt-4">
                <Button 
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  {portalLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <CreditCard className="h-4 w-4 mr-2" />
                  Manage Subscription
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing Plans */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Choose Your Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICING_PLANS.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                currentPlan={currentPlan}
                onSubscribe={handleSubscribe}
                loading={loading}
              />
            ))}
          </div>
        </div>

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Need Help?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <strong className="text-blue-900">Billing Questions:</strong>
                  <p className="text-blue-800 text-sm">Contact our support team for any billing-related inquiries.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <Calendar className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <strong className="text-green-900">Subscription Changes:</strong>
                  <p className="text-green-800 text-sm">Changes take effect at the next billing cycle.</p>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              <p>
                • Cancel anytime with no hidden fees
              </p>
              <p>
                • Credits reset monthly and don't roll over
              </p>
              <p>
                • Secure payments processed by Stripe
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 