'use server'

import { JWT } from 'next-auth/jwt'
import { getPrismaClient } from './db'

export async function refreshJwt(token: JWT): Promise<JWT> {
  try {
    const prisma = getPrismaClient()

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
      if (
        refreshedUser.sessionInvalidatedAt &&
        (!token.sessionInvalidatedAt ||
          new Date(refreshedUser.sessionInvalidatedAt) >
            new Date(token.sessionInvalidatedAt as string))
      ) {
        console.log('Session was invalidated, forcing revalidation')
        token.sessionInvalidatedAt = refreshedUser.sessionInvalidatedAt.toISOString()
        return {
          ...token,
          exp: Math.floor(Date.now() / 1000) + 60, // Expire in 1 minute
        }
      }

      token.credits = refreshedUser.credits
      token.subscriptionStatus = refreshedUser.subscriptionStatus
      token.subscriptionPlan = refreshedUser.subscriptionPlan
      token.stripeCustomerId = refreshedUser.stripeCustomerId
      token.isAdmin = refreshedUser.isAdmin
      token.sessionValidUntil = Date.now() + 1000 * 60 * 5 // Re-validate in 5 minutes
    }
  } catch (error) {
    console.error('Failed to refresh user data in JWT callback:', error)
  }

  return token
} 