import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/next-auth'
import { prisma } from '@/lib/db'

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

    // Get query parameters for pagination and filtering
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Fetch user's generated images
    const images = await prisma.generatedImage.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        prompt: true,
        imageUrl: true,
        generationParams: true,
        creditsUsed: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limit
    })

    // Get total count for pagination
    const totalCount = await prisma.generatedImage.count({
      where: {
        userId: session.user.id
      }
    })

    return NextResponse.json({
      success: true,
      images: images.map(image => ({
        id: image.id,
        prompt: image.prompt,
        imageUrl: image.imageUrl,
        generationParams: image.generationParams,
        creditsUsed: image.creditsUsed,
        createdAt: image.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: offset + limit < totalCount,
        hasPrev: page > 1
      }
    })

  } catch (error) {
    console.error('Gallery API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 