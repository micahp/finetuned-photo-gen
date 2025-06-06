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

// Helper to check if we're in development mode
const isDev = process.env.NODE_ENV === 'development'

export default function BillingPage() {
  const { data: session, status, update } = useSession()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [processingSubscription, setProcessingSubscription] = useState(false)
  const [canceledPlanName, setCanceledPlanName] = useState<string | null>(null)
  
  // Check for missing webhook secret in development
  const [missingWebhookSecret, setMissingWebhookSecret] = useState(false)
  
  useEffect(() => {
    // Only check in development mode
    if (isDev) {
      // Use an API route to check if the secret is set (to avoid exposing env vars to client)
      fetch('/api/config/check-webhook-secret')
        .then(res => res.json())
        .then(data => {
          setMissingWebhookSecret(!data.webhookSecretSet)
        })
        .catch(() => {
          // If the endpoint doesn't exist, we'll assume the secret is missing
          setMissingWebhookSecret(true)
        })
    }
  }, [])

  // Handle success/cancel from Stripe checkout
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const canceled = searchParams.get('canceled')

    if (sessionId) {
      // Show processing indicator immediately 
      setProcessingSubscription(true)
      
      // Show initial acknowledgment to the user right away
      toast.info('Payment received! Setting up your subscription...', {
        id: 'subscription-processing' // Add an ID to prevent duplicates
      })
      
      // Add a polling mechanism to wait for subscription to be processed by webhook
      let attempts = 0;
      const maxAttempts = 20; // Maximum number of attempts (60 seconds total)
      let hasShownSuccessMessage = false;
      
      const checkSubscriptionStatus = async () => {
        attempts++;
        
        try {
          // New: Poll lightweight API endpoint
          const response = await fetch('/api/user/subscription-status');
          const data = await response.json();

          if (data.subscriptionStatus === 'active') {
            if (!hasShownSuccessMessage) {
              toast.success('Subscription activated! Your account has been updated.', {
                id: 'subscription-success'
              });
              hasShownSuccessMessage = true;
            }
            
            setProcessingSubscription(false);
            
            // Final session update to sync the whole app
            update({ force: true });

            const url = new URL(window.location.href);
            url.searchParams.delete('session_id');
            window.history.replaceState({}, document.title, url.toString());
            return; // Stop polling
          }
        } catch (error) {
          console.error("Failed to check subscription status", error);
          // Decide if we should stop or continue on error
        }
        
        if (attempts >= maxAttempts) {
          toast.info('Your subscription is still processing. The page will update automatically when ready, or you can refresh in a few moments.', {
            id: 'subscription-pending'
          });
          
          const url = new URL(window.location.href);
          url.searchParams.delete('session_id');
          window.history.replaceState({}, document.title, url.toString());
          
          // Fallback to less frequent session updates after timeout
          setTimeout(() => update({ force: true }), 10000);
          return;
        }
        
        setTimeout(checkSubscriptionStatus, 3000);
      }
      
      // Start checking
      checkSubscriptionStatus();
    } else if (canceled) {
      // Store the plan name *before* updating the session
      const planBeforeUpdate = getCurrentPlan(session?.user?.subscriptionPlan)
      if (planBeforeUpdate && planBeforeUpdate.name !== 'Free') {
        setCanceledPlanName(planBeforeUpdate.name)
      }

      // Update session to reflect latest state
      update() // Use GET request to avoid CSRF issues
      
      toast.info('Subscription canceled. You can try again anytime.', {
        id: 'subscription-canceled' // Add an ID to prevent duplicates
      })
      
      // Clean up the URL
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
          priceId: planId, // Using the plan ID, which the API will resolve to a price ID
          mode: 'subscription',
          quantity: 1
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      if (!data.url) {
        throw new Error('No checkout URL returned')
      }

      // Redirect to Stripe Checkout (use replace to avoid browser history issues)
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
        {/* Developer Warning for Missing Webhook Secret */}
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