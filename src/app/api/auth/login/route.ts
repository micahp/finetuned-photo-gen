import { NextRequest, NextResponse } from 'next/server'
import { validateCredentials } from '@/lib/auth'
import { LoginRequest, ApiResponse } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json()
    const { email, password } = body

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

    // Validate credentials
    const user = await validateCredentials(email.toLowerCase(), password)

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email or password',
        } as ApiResponse,
        { status: 401 }
      )
    }

    // Success - return user data
    return NextResponse.json(
      {
        success: true,
        data: { user },
        message: 'Login successful',
      } as ApiResponse,
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('Login error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as ApiResponse,
      { status: 500 }
    )
  }
} 