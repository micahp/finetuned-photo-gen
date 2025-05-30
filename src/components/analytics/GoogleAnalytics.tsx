'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

interface GoogleAnalyticsProps {
  trackingId: string
}

interface CookiePreferences {
  essential: boolean
  analytics: boolean
  marketing: boolean
}

export function GoogleAnalytics({ trackingId }: GoogleAnalyticsProps) {
  const [hasConsent, setHasConsent] = useState(false)

  useEffect(() => {
    // Check if user has given consent for analytics cookies
    const checkConsent = () => {
      try {
        const consent = localStorage.getItem('cookie-consent')
        if (!consent) {
          setHasConsent(false)
          return
        }

        const consentData = JSON.parse(consent) as CookiePreferences
        
        // Check if analytics cookies are accepted
        setHasConsent(consentData?.analytics === true)
      } catch (error) {
        console.warn('Error checking cookie consent:', error)
        setHasConsent(false)
      }
    }

    checkConsent()

    // Listen for consent changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cookie-consent') {
        checkConsent()
      }
    }

    // Listen for custom consent events
    const handleConsentChange = (e: CustomEvent) => {
      const preferences = e.detail as CookiePreferences
      setHasConsent(preferences?.analytics === true)
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('cookie-consent-changed', handleConsentChange as EventListener)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('cookie-consent-changed', handleConsentChange as EventListener)
    }
  }, [])

  // Don't load GA if user hasn't consented, no tracking ID, or in development
  if (!hasConsent || !trackingId || process.env.NODE_ENV === 'development') {
    return null
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${trackingId}`}
        strategy="afterInteractive"
        onLoad={() => {
          console.log('Google Analytics loaded successfully')
        }}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${trackingId}', {
              cookie_flags: 'SameSite=Lax;Secure',
              anonymize_ip: true,
              allow_google_signals: false,
              allow_ad_personalization_signals: false,
              cookie_domain: 'auto',
              cookie_expires: 63072000
            });
          `,
        }}
      />
    </>
  )
} 