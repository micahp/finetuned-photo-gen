import { NextAuthConfig } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { validateCredentials } from './auth'

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
    async signIn({ user, account, profile, email, credentials }) {
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
        token.subscriptionStatus = user.subscriptionStatus
        token.subscriptionPlan = user.subscriptionPlan
        token.stripeCustomerId = user.stripeCustomerId
        token.credits = user.credits
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.subscriptionStatus = token.subscriptionStatus as string
        session.user.subscriptionPlan = token.subscriptionPlan as string | null
        session.user.stripeCustomerId = token.stripeCustomerId as string | null
        session.user.credits = token.credits as number
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
        console.log('🔍 Credentials provider authorize called with:', { 
          email: credentials?.email, 
          hasPassword: !!credentials?.password 
        });
        
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing email or password');
          return null
        }

        try {
          console.log('🔍 Validating credentials for:', credentials.email);
          // Use direct validation instead of HTTP call to avoid CSRF issues
          const user = await validateCredentials(
            credentials.email as string, 
            credentials.password as string
          )

          if (!user) {
            console.log('❌ User validation failed');
            return null
          }

          console.log('✅ User validation successful:', { 
            id: user.id, 
            email: user.email, 
            name: user.name 
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionPlan: user.subscriptionPlan,
            stripeCustomerId: user.stripeCustomerId,
            credits: user.credits,
          }
        } catch (error) {
          console.error('❌ Authentication error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
} 