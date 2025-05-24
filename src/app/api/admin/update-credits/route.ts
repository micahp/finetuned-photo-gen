import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { email, credits } = await request.json()

    if (!email || typeof credits !== 'number') {
      return NextResponse.json(
        { error: 'Email and credits (number) are required' },
        { status: 400 }
      )
    }

    // Update user credits
    const user = await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { credits },
      select: {
        id: true,
        email: true,
        name: true,
        credits: true,
      }
    })

    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        credits: user.credits,
      }
    })

  } catch (error) {
    console.error('Update credits error:', error)
    
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 