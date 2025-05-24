import { DefaultSession, DefaultUser } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      subscriptionStatus: string
      subscriptionPlan: string | null
      stripeCustomerId: string | null
      credits: number
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    subscriptionStatus: string
    subscriptionPlan: string | null
    stripeCustomerId: string | null
    credits: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    subscriptionStatus: string
    subscriptionPlan: string | null
    stripeCustomerId: string | null
    credits: number
  }
} 