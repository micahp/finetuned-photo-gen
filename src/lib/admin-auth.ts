import { auth } from '@/lib/next-auth'
import { NextResponse } from 'next/server'

/**
 * Get the current session and verify admin status
 * @returns Session if user is admin, null otherwise
 */
export async function getAdminSession() {
  const session = await auth()
  
  if (!session?.user?.isAdmin) {
    return null
  }
  
  return session
}

/**
 * Middleware to protect admin routes
 * Returns appropriate error responses for unauthorized access
 */
export async function requireAdmin() {
  const session = await getAdminSession()
  
  if (!session) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    )
  }
  
  return null // No error, admin is authenticated
}

/**
 * Check if a user email has admin privileges
 * Useful for debugging and admin management
 */
export async function isUserAdmin(email: string): Promise<boolean> {
  const { prisma } = await import('./db')
  
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { isAdmin: true }
    })
    
    return user?.isAdmin ?? false
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
} 