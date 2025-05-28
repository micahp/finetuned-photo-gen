import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'

// GET /api/user/settings
export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return default settings for now
    // In a real app, these would be stored in the database
    const settings = {
      emailNotifications: true,
      marketingEmails: false,
      generationNotifications: true,
      billingNotifications: true
    }

    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/user/settings
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    
    // Validate the settings object
    const allowedKeys = ['emailNotifications', 'marketingEmails', 'generationNotifications', 'billingNotifications']
    const validSettings = Object.keys(body).every(key => allowedKeys.includes(key))
    
    if (!validSettings) {
      return NextResponse.json({ error: 'Invalid settings provided' }, { status: 400 })
    }

    // In a real app, save to database
    // For now, just return success
    console.log('Settings updated for user:', session.user.email, body)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 