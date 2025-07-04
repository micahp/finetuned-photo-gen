import NextAuth from 'next-auth'
import { NextAuthConfig } from 'next-auth'
import { NextResponse } from 'next/server'

// Minimal auth config for middleware - no server-side imports
const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const isProtectedRoute = pathname.startsWith('/dashboard');
      const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');

      // Redirect unauthenticated users trying to access protected routes
      if (isProtectedRoute && !isLoggedIn) {
        // Build a safe callbackUrl using only local path + query to avoid open redirects
        const callbackUrl = `${pathname}${nextUrl.search}`;
        const loginUrl = new URL('/login', nextUrl);
        loginUrl.searchParams.set('callbackUrl', callbackUrl);
        return NextResponse.redirect(loginUrl);
      }

      // Prevent authenticated users from visiting auth routes
      if (isAuthRoute && isLoggedIn) {
        return NextResponse.redirect(new URL('/dashboard', nextUrl));
      }

      // Allow all other cases to proceed
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