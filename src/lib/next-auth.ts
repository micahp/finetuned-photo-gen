import NextAuth from 'next-auth'
import { baseAuthConfig } from './auth-config'
import { refreshJwt } from '@/lib/actions/auth.actions'
import { prisma } from '@/lib/db'

const SESSION_MAX_AGE_SECONDS = parseInt(process.env.SESSION_MAX_AGE_SECONDS || (60 * 60 * 24 * 30).toString()); // Default: 30 days

export const { 
  handlers: { GET, POST }, 
  auth, 
  signIn, 
  signOut 
} = NextAuth({
  ...baseAuthConfig,
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  events: {
    async signIn({ user }) {
      if (user.id) {
        // A new sign-in is a fresh start. Clear any previous server-side invalidation flags.
        await prisma.user.update({
          where: { id: user.id },
          data: { sessionInvalidatedAt: null },
        });
        console.log(`ℹ️ Cleared session invalidation flag for user ${user.id} on new sign-in.`);
      }
    }
  },
  callbacks: {
    // The authorized callback is client-safe, so we can define it here.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtectedRoute = nextUrl.pathname.startsWith('/dashboard');
      const isAuthRoute = 
        nextUrl.pathname.startsWith('/login') || 
        nextUrl.pathname.startsWith('/register');

      if (isProtectedRoute && !isLoggedIn) {
        return false; // Redirect unauthenticated users to login page
      }

      if (isAuthRoute && isLoggedIn) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }

      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        // On initial sign-in, populate the token with user data
        token.isAdmin = user.isAdmin
        token.subscriptionStatus = user.subscriptionStatus
        token.subscriptionPlan = user.subscriptionPlan
        token.stripeCustomerId = user.stripeCustomerId
        token.credits = user.credits
        token.createdAt = user.createdAt
        token.sessionValidUntil = Date.now() + SESSION_MAX_AGE_SECONDS * 1000
      }
      
      const shouldValidate = !token.sessionValidUntil || 
                            Date.now() > (token.sessionValidUntil as number) ||
                            trigger === 'update';
                            
      if (shouldValidate && token.sub) {
        return refreshJwt(token); // This now safely calls the server action
      }
      
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!
        session.user.isAdmin = token.isAdmin as boolean
        session.user.subscriptionStatus = token.subscriptionStatus as string
        session.user.subscriptionPlan = token.subscriptionPlan as string | null
        session.user.stripeCustomerId = token.stripeCustomerId as string | null
        session.user.credits = token.credits as number
        session.user.createdAt = token.createdAt as string
        
        // Handle session invalidation pushed from the server action
        if (token.error === "SessionInvalidated") {
          // You could sign the user out here, or handle on the client-side
          // For now, we'll nullify the session user to prompt a re-login
           (session as any).error = "SessionInvalidated";
        }
      }
      return session
    }
  }
}) 