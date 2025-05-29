import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'

// PUT /api/user/profile
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, email } = body
    
    // Basic validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    // In a real app, update the database
    // For now, just log and return success
    console.log('Profile update for user:', session.user.email, { name, email })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Profile PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 