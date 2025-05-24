import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/auth'
import { RegisterRequest, ApiResponse } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json()
    const { email, password, name } = body

    // Validation
    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email is required',
        } as ApiResponse,
        { status: 400 }
      )
    }

    if (!password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password is required',
        } as ApiResponse,
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password must be at least 6 characters long',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email format',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Create user
    const user = await createUser(email.toLowerCase(), password, name)

    return NextResponse.json(
      {
        success: true,
        data: { user },
        message: 'User created successfully',
      } as ApiResponse,
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Registration error:', error)

    // Handle duplicate email error
    if (error.message.includes('already exists')) {
      return NextResponse.json(
        {
          success: false,
          error: 'User with this email already exists',
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Handle other errors
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as ApiResponse,
      { status: 500 }
    )
  }
} 