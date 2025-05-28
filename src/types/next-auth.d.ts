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
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    isAdmin: boolean
    subscriptionStatus: string
    subscriptionPlan: string | null
    stripeCustomerId: string | null
    credits: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isAdmin: boolean
    subscriptionStatus: string
    subscriptionPlan: string | null
    stripeCustomerId: string | null
    credits: number
  }
} 