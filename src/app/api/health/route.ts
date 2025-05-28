import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Basic health check - you can add database connectivity check here later
    return NextResponse.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'finetuned-photo-gen'
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: 'Service unavailable' },
      { status: 503 }
    )
  }
} 