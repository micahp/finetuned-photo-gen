import NextAuth from 'next-auth'
import { NextAuthConfig } from 'next-auth'

// Minimal auth config for middleware - no server-side imports
const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
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
  },
  providers: [], // Providers are defined in the main auth config
}

export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
} 