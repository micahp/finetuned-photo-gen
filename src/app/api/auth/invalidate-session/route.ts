import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'

/**
 * This API endpoint allows invalidating a user's session
 * Primarily used when subscription status changes (e.g., cancellation)
 * 
 * It's only accessible with admin credentials or from server-side code with a secret
 */
export async function POST(req: NextRequest) {
  // Only allow server-side calls with API key or admin users
  const session = await auth()
  const isAdmin = session?.user?.isAdmin === true
  
  // API key for server-side calls (e.g., from webhooks)
  const apiKey = req.headers.get('x-api-key')
  const isServerSideCall = apiKey === process.env.INTERNAL_API_KEY
  
  if (!isAdmin && !isServerSideCall) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    )
  }

  try {
    const { userId, email } = await req.json()
    
    if (!userId && !email) {
      return NextResponse.json(
        { error: 'Either userId or email is required' },
        { status: 400 }
      )
    }

    // Find the user
    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : { email },
      select: { id: true, email: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // We can't directly invalidate a session with Next-Auth
    // But we can add a timestamp to the user record that clients can check
    // This timestamp can be used to force a session refresh
    await prisma.user.update({
      where: { id: user.id },
      data: {
        sessionInvalidatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: `Session invalidation triggered for user ${user.email}`
    })
    
  } catch (error) {
    console.error('Error invalidating session:', error)
    return NextResponse.json(
      { error: 'Failed to invalidate session' },
      { status: 500 }
    )
  }
} 