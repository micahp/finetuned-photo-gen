'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'

/**
 * This component checks for subscription status changes and ensures
 * users can't continue generating content after subscription cancellation
 */
export function SubscriptionStatusChecker() {
  const { data: session, status, update } = useSession()
  const pathname = usePathname()

  // Check user's subscription status periodically on protected pages
  useEffect(() => {
    // Only check on dashboard pages, but exclude the billing page which has its own logic
    if (!pathname?.startsWith('/dashboard') || pathname === '/dashboard/billing') {
      return
    }

    // Skip if not authenticated yet
    if (status !== 'authenticated' || !session?.user) {
      return
    }

    // We only need to periodically check if user has active subscription
    const isSubscribed = session.user.subscriptionStatus === 'active'
    
    // Set up the interval checker only for subscribed users
    if (isSubscribed) {
      const checkInterval = setInterval(() => {
        // Force refresh of session data
        update({ force: true })
      }, 60000) // Check every minute
      
      return () => clearInterval(checkInterval)
    }
  }, [pathname, session?.user?.subscriptionStatus, status, update])

  // This component doesn't render anything
  return null
} 