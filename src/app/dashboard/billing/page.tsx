'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PricingCard } from '@/components/billing/pricing-card'
import { PRICING_PLANS, getCurrentPlan } from '@/lib/stripe/pricing'
import { toast } from 'sonner'
import { 
  CreditCard, 
  Calendar, 
  Crown, 
  ExternalLink, 
  CheckCircle, 
  Loader2
} from 'lucide-react'
import { SessionRefresher } from '@/components/auth/SessionRefresher'
import { CREDIT_COSTS } from '@/lib/credits/constants'

const isDev = process.env.NODE_ENV === 'development'

export default function BillingPage() {
  const { data: session, status, update } = useSession()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [processingSubscription, setProcessingSubscription] = useState(false)
  const [canceledPlanName, setCanceledPlanName] = useState<string | null>(null)
  const [missingWebhookSecret, setMissingWebhookSecret] = useState(false)
  const pollingRef = useRef<boolean>(false)
  
  useEffect(() => {
    if (isDev) {
      fetch('/api/config/check-webhook-secret')
        .then(res => res.json())
        .then(data => {
          setMissingWebhookSecret(!data.webhookSecretSet)
        })
        .catch(() => {
          setMissingWebhookSecret(true)
        })
    }
  }, [])

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const canceled = searchParams.get('canceled')
    const refresh = searchParams.get('refresh')

    // Clean up refresh parameter without triggering session update to avoid infinite reload
    if (refresh === 'true') {
      const url = new URL(window.location.href)
      url.searchParams.delete('refresh')
      window.history.replaceState({}, document.title, url.toString())
    }

    if (sessionId && !pollingRef.current) {
      pollingRef.current = true;
      setProcessingSubscription(true)
      toast.info('Payment received! Setting up your subscription...', {
        id: 'subscription-processing'
      })
      
      let attempts = 0;
      const maxAttempts = 20;
      let hasShownSuccessMessage = false;
      let timeoutId: NodeJS.Timeout | null = null;
      
      const checkSubscriptionStatus = async () => {
        attempts++;
        
        try {
          const response = await fetch('/api/user/subscription-status');
          const data = await response.json();

          if (data.subscriptionStatus === 'active') {
            console.log('✅ Subscription activated, showing success message');
            
            if (!hasShownSuccessMessage) {
              toast.success('Subscription activated! Please log out and log back in to use your new subscription.', {
                id: 'subscription-success',
                duration: 10000, // Show for 10 seconds
              });
              hasShownSuccessMessage = true;
            }
            
            setProcessingSubscription(false);
            pollingRef.current = false;
            
            // Force session update now that subscription is active
            console.log('🔄 Triggering session update for successful subscription')
            await update()
            
            // Wait a moment for session to update, then refresh the page
            setTimeout(() => {
              window.location.reload()
            }, 1000)
            
            const url = new URL(window.location.href);
            url.searchParams.delete('session_id');
            window.history.replaceState({}, document.title, url.toString());
            return;
          }
        } catch (error) {
          console.error("Failed to check subscription status", error);
        }
        
        if (attempts >= maxAttempts) {
          toast.info('Your subscription is still processing. The page will update automatically when ready.', {
            id: 'subscription-pending'
          });
          
          setProcessingSubscription(false);
          pollingRef.current = false;
          
          const url = new URL(window.location.href);
          url.searchParams.delete('session_id');
          window.history.replaceState({}, document.title, url.toString());
          
          return;
        }
        
        timeoutId = setTimeout(checkSubscriptionStatus, 3000);
      }
      
      checkSubscriptionStatus();
      
      // Cleanup function to prevent memory leaks
      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        pollingRef.current = false;
      };
    } else if (canceled) {
      const planBeforeUpdate = getCurrentPlan(session?.user?.subscriptionPlan || null)
      if (planBeforeUpdate && planBeforeUpdate.name !== 'Free') {
        setCanceledPlanName(planBeforeUpdate.name)
      }

      update()
      
      toast.info('Subscription canceled. You can try again anytime.', {
        id: 'subscription-canceled'
      })
      
      const url = new URL(window.location.href)
      url.searchParams.delete('canceled')
      window.history.replaceState({}, document.title, url.toString())
    }
  }, [searchParams, update])

  const handleSubscribe = async (planId: string) => {
    if (!session?.user) {
      toast.error('Please sign in to subscribe')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: planId,
          mode: 'subscription',
          returnUrl: `${window.location.origin}/dashboard/billing` // Use origin + path instead of full href
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      if (!data.url) {
        throw new Error('No checkout URL returned')
      }

      window.location.replace(data.url)
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
      <div className="flex items-center justify-center min-h-96" role="status">
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
        {isDev && missingWebhookSecret && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                 <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                 </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Developer Warning: Stripe Webhook Secret Missing
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p className="mb-1">
                    Subscriptions will not be processed correctly because the Stripe webhook secret is not configured.
                  </p>
                  <p className="mb-1">
                    To fix this:
                  </p>
                  <ol className="list-decimal list-inside ml-2 space-y-1">
                    <li>Install the <a href="https://stripe.com/docs/stripe-cli" target="_blank" rel="noopener noreferrer" className="underline">Stripe CLI</a></li>
                    <li>Run: <code className="bg-yellow-100 px-1 py-0.5 rounded">stripe listen --forward-to localhost:3000/api/stripe/webhooks</code></li>
                    <li>Add the webhook secret to your <code className="bg-yellow-100 px-1 py-0.5 rounded">.env.local</code> file as <code className="bg-yellow-100 px-1 py-0.5 rounded">STRIPE_WEBHOOK_SECRET=whsec_...</code></li>
                    <li>Restart your development server</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-gray-600 mt-2">
            Manage your subscription and billing information
          </p>
          
          {processingSubscription && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md flex items-center space-x-3">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <span className="text-blue-700">Processing your subscription, please wait...</span>
            </div>
          )}
        </div>

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
            {canceledPlanName && (
              <div className="mb-4 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      Your <span className="font-semibold">{canceledPlanName}</span> subscription has been canceled. You are now on the Free plan.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{currentPlan.name} Plan</h3>
                <p className="text-gray-600">{currentPlan.credits.toLocaleString()} credits / month</p>
              </div>
              <div className="text-right">
                <Badge variant={isSubscribed ? 'default' : 'secondary'}>
                  {session.user.subscriptionStatus === 'active' ? 'Active' : 'Free'}
                </Badge>
              </div>
            </div>

            <hr className="border-gray-200" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Credit Costs (per action)
            </CardTitle>
            <CardDescription>
              Current credit pricing for each paid action
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left font-medium text-gray-700">Action</th>
                    <th scope="col" className="px-4 py-2 text-left font-medium text-gray-700">Credits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(CREDIT_COSTS).map(([key, value]) => (
                    <tr key={key}>
                      <td className="px-4 py-2 capitalize">{key.replace('_', ' ')}</td>
                      <td className="px-4 py-2">{key === 'video' ? `from ${value}` : value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        
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