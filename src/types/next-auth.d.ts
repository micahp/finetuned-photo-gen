import { DefaultSession, DefaultUser } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      isAdmin: boolean
      subscriptionStatus: string
      subscriptionPlan: string | null
      stripeCustomerId: string | null
      credits: number
      createdAt: string
    } & DefaultSession['user']
    error?: 'SessionInvalidated' | 'RefreshError'
  }

  interface User extends DefaultUser {
    isAdmin: boolean
    subscriptionStatus: string
    subscriptionPlan: string | null
    stripeCustomerId: string | null
    credits: number
    createdAt: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isAdmin: boolean
    subscriptionStatus: string
    subscriptionPlan: string | null
    stripeCustomerId: string | null
    credits: number
    createdAt: string
  }
} 