import { NextAuthConfig } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

// Dynamic import to avoid Edge Runtime issues with bcryptjs
async function validateCredentials(email: string, password: string) {
  // Use dynamic import to load Node.js-specific auth functions only when needed
  const { validateCredentials: validateCreds } = await import('./auth')
  return validateCreds(email, password)
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isProtectedRoute = nextUrl.pathname.startsWith('/dashboard')
      const isAuthRoute = nextUrl.pathname.startsWith('/login') || 
                         nextUrl.pathname.startsWith('/register')

      if (isProtectedRoute && !isLoggedIn) {
        return false // Redirect to login page
      }

      if (isAuthRoute && isLoggedIn) {
        return Response.redirect(new URL('/dashboard', nextUrl))
      }

      return true
    },
    async signIn({ user, account: _account, profile: _profile, email: _email, credentials: _credentials }) {
      // Allow sign in if user exists
      return !!user
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
    async jwt({ token, user }) {
      if (user) {
        token.isAdmin = user.isAdmin
        token.subscriptionStatus = user.subscriptionStatus
        token.subscriptionPlan = user.subscriptionPlan
        token.stripeCustomerId = user.stripeCustomerId
        token.credits = user.credits
        token.createdAt = user.createdAt
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.isAdmin = token.isAdmin as boolean
        session.user.subscriptionStatus = token.subscriptionStatus as string
        session.user.subscriptionPlan = token.subscriptionPlan as string | null
        session.user.stripeCustomerId = token.stripeCustomerId as string | null
        session.user.credits = token.credits as number
        session.user.createdAt = token.createdAt as string
      }
      return session
    },
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