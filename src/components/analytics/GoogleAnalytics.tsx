'use client'

import Script from 'next/script'

interface GoogleAnalyticsProps {
  trackingId: string
}

export function GoogleAnalytics({ trackingId }: GoogleAnalyticsProps) {
  // Only check for tracking ID and environment - always load in production
  if (!trackingId || process.env.NODE_ENV === 'development') {
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
              cookie_domain: 'auto',
              cookie_expires: 63072000
            });
          `,
        }}
      />
    </>
  )
} 