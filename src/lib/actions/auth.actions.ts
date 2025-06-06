'use server'

import { JWT } from 'next-auth/jwt'
import { prisma } from '@/lib/db' // Adjusted path for new location

export async function refreshJwt(token: JWT): Promise<JWT> {
  try {
    // No need for getPrismaClient(), direct import is fine in server actions
    const refreshedUser = await prisma.user.findUnique({
      where: { id: token.sub },
      select: {
        credits: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        stripeCustomerId: true,
        isAdmin: true,
        sessionInvalidatedAt: true,
      },
    })

    if (refreshedUser) {
      // Check if the session has been marked as invalid on the server
      if (
        refreshedUser.sessionInvalidatedAt &&
        (!token.sessionInvalidatedAt ||
          new Date(refreshedUser.sessionInvalidatedAt) >
            new Date(token.sessionInvalidatedAt as string))
      ) {
        console.log(`ℹ️ Server-side session invalidation for user ${token.sub}. Forcing re-login.`)
        // By returning a token with a 'force-refresh' flag, we can trigger a client-side redirect.
        return {
          ...token,
          error: "SessionInvalidated",
        }
      }

      // Update token with fresh data
      token.credits = refreshedUser.credits
      token.subscriptionStatus = refreshedUser.subscriptionStatus
      token.subscriptionPlan = refreshedUser.subscriptionPlan
      token.stripeCustomerId = refreshedUser.stripeCustomerId
      token.isAdmin = refreshedUser.isAdmin
      token.sessionValidUntil = Date.now() + 1000 * 60 * 5 // Re-validate in 5 minutes
    }
  } catch (error) {
    console.error('🔴 Failed to refresh user data in JWT callback:', error)
    // We can add an error to the token to handle it gracefully on the client
    token.error = "RefreshError"
  }

  return token
} 