'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Crown, Loader2 } from 'lucide-react'
import { PricingPlan } from '@/lib/stripe/pricing'
import { toast } from 'sonner'

interface PricingCardProps {
  plan: PricingPlan
  currentPlan?: PricingPlan
  onSubscribe?: (priceId: string) => Promise<void>
  loading?: boolean
}

export function PricingCard({ plan, currentPlan, onSubscribe, loading = false }: PricingCardProps) {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  
  const isCurrentPlan = currentPlan?.id === plan.id
  const isFreePlan = plan.id === 'free'
  const isUpgrade = currentPlan && plan.price > currentPlan.price
  const isDowngrade = currentPlan && plan.price < currentPlan.price && !isFreePlan

  const handleSubscribe = async () => {
    if (!session?.user) {
      toast.error('Please sign in to subscribe')
      return
    }

    if (isFreePlan) {
      toast.info('You are already on the free plan')
      return
    }

    if (isCurrentPlan) {
      toast.info('This is your current plan')
      return
    }

    setIsLoading(true)
    try {
      await onSubscribe?.(plan.id)
    } catch (error) {
      console.error('Subscription error:', error)
      toast.error('Failed to start subscription process')
    } finally {
      setIsLoading(false)
    }
  }

  const getButtonText = () => {
    if (isCurrentPlan) return 'Current Plan'
    if (isUpgrade) return `Upgrade to ${plan.name}`
    if (isDowngrade) return `Downgrade to ${plan.name}`
    return plan.buttonText
  }

  const getButtonVariant = () => {
    if (isCurrentPlan) return 'outline'
    if (plan.popular) return 'default'
    return 'outline'
  }

  return (
    <Card className={`relative ${plan.popular ? 'border-blue-500 shadow-lg' : ''} ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}>
      {plan.popular && (
        <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-blue-500">
          Most Popular
        </Badge>
      )}
      
      {isCurrentPlan && (
        <Badge className="absolute -top-2 right-4 bg-green-500">
          <Crown className="h-3 w-3 mr-1" />
          Current
        </Badge>
      )}

      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        <div className="mt-4">
          <span className="text-4xl font-bold">${plan.price}</span>
          {!isFreePlan && <span className="text-gray-500">/month</span>}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Monthly Credits</span>
            <span className="font-semibold">{plan.credits.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Model Training Slots</span>
            <span className="font-semibold">{plan.maxModels}</span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Features</h4>
          <ul className="space-y-1">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-center text-sm">
                <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <Button
          onClick={handleSubscribe}
          disabled={isCurrentPlan || isLoading || loading}
          variant={getButtonVariant()}
          className="w-full"
        >
          {(isLoading || loading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {getButtonText()}
        </Button>
      </CardContent>
    </Card>
  )
} 