'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CREDIT_PACKS, type CreditPack } from '@/lib/stripe/pricing'
import { toast } from 'sonner'
import { Zap, Check, Loader2 } from 'lucide-react'
import Link from 'next/link'

export function PhotoPackSection() {
  const { data: session } = useSession()
  const [loadingPack, setLoadingPack] = useState<string | null>(null)

  const handlePurchase = async (pack: CreditPack) => {
    if (!session?.user) {
      toast.error('Please sign in to purchase credits')
      return
    }

    setLoadingPack(pack.id)
    try {
      const response = await fetch('/api/stripe/create-photo-pack-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pack.id }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to create checkout')

      window.location.replace(data.url)
    } catch (error) {
      console.error('Purchase error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to start purchase')
    } finally {
      setLoadingPack(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
          <Zap className="h-4 w-4" />
          One-time purchase — no subscription required
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Buy Photo Credits
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Need more than a subscription? Buy credit packs and use them whenever you want.
          Credits never expire, so stock up and save.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {CREDIT_PACKS.map((pack) => (
          <Card
            key={pack.id}
            className={`relative transition-all hover:shadow-lg ${
              pack.popular
                ? 'border-brand-blue border-2 shadow-md scale-[1.02]'
                : 'border-gray-200'
            }`}
          >
            {pack.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-brand-blue text-white">Most Popular</Badge>
              </div>
            )}
            {pack.savings && (
              <div className="absolute -top-3 right-3">
                <Badge className="bg-green-500 text-white">{pack.savings}</Badge>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-lg">{pack.name}</CardTitle>
              <CardDescription>{pack.description}</CardDescription>
              <div className="mt-2">
                <span className="text-3xl font-bold">${pack.price.toFixed(2)}</span>
                <span className="text-gray-500 text-sm"> one-time</span>
              </div>
              <div className="text-sm text-brand-blue font-semibold">
                {pack.credits.toLocaleString()} credits
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => handlePurchase(pack)}
                disabled={!!loadingPack}
                className={`w-full ${
                  pack.popular
                    ? 'bg-brand-blue hover:bg-blue-700'
                    : ''
                }`}
                variant={pack.popular ? 'default' : 'outline'}
              >
                {loadingPack === pack.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {pack.buttonText}
              </Button>
              {!session?.user && (
                <p className="text-xs text-center text-gray-400 mt-1">
                  <Link href="/login" className="underline hover:text-brand-blue">
                    Sign in
                  </Link>{' '}
                  to purchase
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-6 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Check className="h-4 w-4 text-green-500" />
            Credits never expire
          </span>
          <span className="flex items-center gap-1">
            <Check className="h-4 w-4 text-green-500" />
            Secure payment via Stripe
          </span>
          <span className="flex items-center gap-1">
            <Check className="h-4 w-4 text-green-500" />
            Instant delivery
          </span>
        </div>
      </div>
    </div>
  )
}
