'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { X, Settings } from 'lucide-react'

interface CookiePreferences {
  essential: boolean
  analytics: boolean
  marketing: boolean
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always required
    analytics: false,
    marketing: false
  })

  useEffect(() => {
    // Check if user has already made a choice
    const savedConsent = localStorage.getItem('cookie-consent')
    if (!savedConsent) {
      setShowBanner(true)
    } else {
      try {
        const parsed = JSON.parse(savedConsent)
        // Handle legacy format
        if (typeof parsed === 'string') {
          setShowBanner(false)
        } else if (parsed && typeof parsed === 'object') {
          setPreferences(prev => ({ ...prev, ...parsed }))
          setShowBanner(false)
        }
      } catch (error) {
        console.warn('Error parsing cookie consent:', error)
        setShowBanner(true)
      }
    }
  }, [])

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem('cookie-consent', JSON.stringify(prefs))
    
    // Dispatch custom event for other components to listen to
    const event = new CustomEvent('cookie-consent-changed', { detail: prefs })
    window.dispatchEvent(event)
    
    setShowBanner(false)
    setShowSettings(false)
  }

  const handleAcceptAll = () => {
    const allAccepted = {
      essential: true,
      analytics: true,
      marketing: true
    }
    savePreferences(allAccepted)
  }

  const handleEssentialOnly = () => {
    const essentialOnly = {
      essential: true,
      analytics: false,
      marketing: false
    }
    savePreferences(essentialOnly)
  }

  const handleSaveCustom = () => {
    savePreferences(preferences)
  }

  const handleDismiss = () => {
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <Card className="max-w-4xl mx-auto p-6 bg-white border-2 shadow-lg">
        {!showSettings ? (
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                We use cookies
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                We use essential cookies to make our site work. We'd also like to set optional analytics cookies to help us improve it. 
                You can manage your preferences or learn more in our{' '}
                <Link href="/legal/cookies" className="text-blue-600 hover:text-blue-800 underline">
                  Cookie Policy
                </Link>
                .
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleAcceptAll} size="sm">
                  Accept All
                </Button>
                <Button onClick={handleEssentialOnly} variant="outline" size="sm">
                  Essential Only
                </Button>
                <Button 
                  onClick={() => setShowSettings(true)} 
                  variant="ghost" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Manage Preferences
                </Button>
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
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Cookie Preferences
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="essential" className="text-sm font-medium">
                    Essential Cookies
                  </Label>
                  <p className="text-xs text-gray-600">
                    Required for the website to function properly (authentication, security)
                  </p>
                </div>
                <Switch
                  id="essential"
                  checked={true}
                  disabled={true}
                  className="ml-4"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="analytics" className="text-sm font-medium">
                    Analytics Cookies
                  </Label>
                  <p className="text-xs text-gray-600">
                    Help us understand how you use our site to improve performance
                  </p>
                </div>
                <Switch
                  id="analytics"
                  checked={preferences.analytics}
                  onCheckedChange={(checked) => 
                    setPreferences(prev => ({ ...prev, analytics: checked }))
                  }
                  className="ml-4"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="marketing" className="text-sm font-medium">
                    Marketing Cookies
                  </Label>
                  <p className="text-xs text-gray-600">
                    Used to deliver relevant advertisements and track campaign performance
                  </p>
                </div>
                <Switch
                  id="marketing"
                  checked={preferences.marketing}
                  onCheckedChange={(checked) => 
                    setPreferences(prev => ({ ...prev, marketing: checked }))
                  }
                  className="ml-4"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button onClick={handleSaveCustom} size="sm">
                Save Preferences
              </Button>
              <Button onClick={handleAcceptAll} variant="outline" size="sm">
                Accept All
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
} 