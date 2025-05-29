'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { X } from 'lucide-react'

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Check if user has already made a choice
    const hasConsented = localStorage.getItem('cookie-consent')
    if (!hasConsented) {
      setShowBanner(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted')
    setShowBanner(false)
  }

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined')
    setShowBanner(false)
  }

  const handleDismiss = () => {
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <Card className="max-w-4xl mx-auto p-6 bg-white border-2 shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              We use cookies
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              We use essential cookies to make our site work. We&apos;d also like to set optional analytics cookies to help us improve it. 
              You can manage your preferences or learn more in our{' '}
              <Link href="/legal/cookies" className="text-blue-600 hover:text-blue-800 underline">
                Cookie Policy
              </Link>
              .
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleAccept} size="sm">
                Accept All
              </Button>
              <Button onClick={handleDecline} variant="outline" size="sm">
                Essential Only
              </Button>
              <Link href="/legal/cookies">
                <Button variant="ghost" size="sm">
                  Manage Preferences
                </Button>
              </Link>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="ml-4 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  )
} 