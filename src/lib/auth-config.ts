import { NextAuthConfig } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { refreshJwt } from '@/lib/actions/auth.actions'

// This file now exports a 'base' config that is client-safe.
// The server-only callbacks (jwt, session) are handled in src/lib/next-auth.ts

// Dynamic import to avoid Edge Runtime issues with bcryptjs
async function validateCredentials(email: string, password: string) {
  // Use dynamic import to load Node.js-specific auth functions only when needed
  const { validateCredentials: validateCreds } = await import('./auth')
  return validateCreds(email, password)
}

export const baseAuthConfig: Omit<NextAuthConfig, 'callbacks'> = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Use dynamic import to avoid Edge Runtime issues
          const user = await validateCredentials(
            credentials.email as string, 
            credentials.password as string
          )

          if (!user) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            isAdmin: user.isAdmin,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionPlan: user.subscriptionPlan,
            stripeCustomerId: user.stripeCustomerId,
            credits: user.credits,
            createdAt: user.createdAt.toISOString(),
          }
        } catch (error) {
          console.error('Authentication error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
} 