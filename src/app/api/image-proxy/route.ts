import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get image URL from query parameters
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      )
    }

    // Validate that it's a reasonable image URL (basic security check)
    try {
      const url = new URL(imageUrl)
      // Allow common image hosting domains
      const allowedDomains = [
        'together.ai',
        'api.together.xyz',
        'storage.googleapis.com',
        'amazonaws.com',
        'cloudflare.com',
        'huggingface.co'
      ]
      
      const isAllowed = allowedDomains.some(domain => 
        url.hostname.includes(domain) || url.hostname.endsWith(domain)
      )
      
      if (!isAllowed) {
        return NextResponse.json(
          { error: 'URL not from allowed domain' },
          { status: 403 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Fetch the image with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ImageProxy/1.0'
        }
      })
      
      clearTimeout(timeoutId)

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch image: ${response.status}` },
          { status: 502 }
        )
      }

      const buffer = await response.arrayBuffer()
      const contentType = response.headers.get('content-type') || 'image/jpeg'

      // Validate it's actually an image
      if (!contentType.startsWith('image/')) {
        return NextResponse.json(
          { error: 'URL does not point to an image' },
          { status: 400 }
        )
      }

      // Return the image with proper CORS headers
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })

    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timeout' },
          { status: 504 }
        )
      }
      
      throw error
    }

  } catch (error) {
    console.error('Image proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 